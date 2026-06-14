import { Telegraf } from "telegraf";
import axios from "axios";
import http from "http";
import fs from "fs";
import path from "path";
import os from "os";

const BOT_TOKEN = process.env.BOT_TOKEN;
const NLP_API_KEY = process.env.NLP_API_KEY;

// --- защита от кривого запуска ---
if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is missing");
  process.exit(1);
}

if (!NLP_API_KEY) {
  console.error("NLP_API_KEY is missing");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// --- KEEP ALIVE SERVER (Render fix) ---
http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("OK");
  })
  .listen(process.env.PORT || 3000, () => {
    console.log("HTTP server running");
  });

// --- start ---
bot.start((ctx) => {
  ctx.reply("Бот работает. Отправь текст или голосовое.");
});

// --- text handler ---
bot.on("text", async (ctx) => {
  try {
    await ctx.reply("Принял текст: " + ctx.message.text);
  } catch (e) {
    console.error("TEXT ERROR:", e);
  }
});

// --- voice handler ---
bot.on("voice", async (ctx) => {
  try {
    await ctx.reply("⏳ Голос получен, обрабатываю...");

    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);

    const response = await axios.get(link.href, {
      responseType: "arraybuffer",
    });

    const filePath = path.join(os.tmpdir(), `${Date.now()}.ogg`);
    fs.writeFileSync(filePath, Buffer.from(response.data));

    const text = await speechToText(filePath);

    if (!text) {
      await ctx.reply("❌ Не удалось распознать голос");
      return;
    }

    await ctx.reply("📝 Текст: " + text);
  } catch (e) {
    console.error("VOICE ERROR:", e);
    await ctx.reply("❌ Ошибка обработки голоса");
  }
});

// --- NLPCloud STT ---
async function speechToText(filePath) {
  try {
    const file = fs.readFileSync(filePath);

    const res = await axios.post(
      "https://api.nlpcloud.io/v1/asr/whisper",
      file,
      {
        headers: {
          Authorization: `Token ${NLP_API_KEY}`,
          "Content-Type": "application/octet-stream",
        },
      }
    );

    return res.data?.text || null;
  } catch (e) {
    console.error("STT ERROR:", e?.response?.data || e.message);
    return null;
  }
}

// --- SAFER LAUNCH (fix 409 crash handling) ---
async function startBot() {
  try {
    await bot.launch();
    console.log("Bot started");
  } catch (e) {
    console.error("LAUNCH ERROR:", e.message);
    setTimeout(startBot, 5000); // retry вместо падения
  }
}

// graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

startBot();
