import 'dotenv/config';
import { Telegraf } from 'telegraf';
import axios from 'axios';
import http from 'http';
import fs from 'fs';

const BOT_TOKEN = process.env.BOT_TOKEN;
const NLP_API_KEY = process.env.NLP_API_KEY;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is missing');
}

const bot = new Telegraf(BOT_TOKEN);

/* =========================
   КОСТЫЛЬ ДЛЯ RENDER (KEEP ALIVE)
========================= */
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot is running");
}).listen(process.env.PORT || 3000);

/* =========================
   ЗАГРУЗКА ГОЛОСА ИЗ TELEGRAM
========================= */
async function downloadFile(fileId) {
  const file = await bot.telegram.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

/* =========================
   NLP CLOUD SPEECH TO TEXT
========================= */
async function speechToText(buffer) {
  try {
    const response = await axios.post(
      'https://api.nlpcloud.io/v1/bart-large-speech-recognition/transcription',
      {
        audio: buffer.toString('base64')
      },
      {
        headers: {
          Authorization: `Token ${NLP_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data?.text || null;
  } catch (err) {
    console.log('STT ERROR:', err?.response?.data || err.message);
    return null;
  }
}

/* =========================
   /start
========================= */
bot.start((ctx) => {
  ctx.reply('Бот запущен. Отправь текст или голос.');
});

/* =========================
   ТЕКСТ
========================= */
bot.on('text', async (ctx) => {
  try {
    await ctx.reply(`Ты написал: ${ctx.message.text}`);
  } catch (e) {
    console.log('TEXT ERROR:', e.message);
  }
});

/* =========================
   ГОЛОС
========================= */
bot.on('voice', async (ctx) => {
  const msg = await ctx.reply('⏳ Обрабатываю голос...');

  try {
    const fileId = ctx.message.voice.file_id;

    const audioBuffer = await downloadFile(fileId);

    const text = await speechToText(audioBuffer);

    if (!text) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        msg.message_id,
        null,
        '❌ Не удалось распознать голос'
      );
      return;
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
      `🎤 Распознано:\n${text}`
    );

  } catch (err) {
    console.log('VOICE ERROR:', err.message);

    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        msg.message_id,
        null,
        '❌ Ошибка обработки голоса'
      );
    } catch {}
  }
});

/* =========================
   ЗАПУСК БОТА (СТАБИЛЬНЫЙ)
========================= */
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
