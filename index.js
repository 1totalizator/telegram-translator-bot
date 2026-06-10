import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import fs from "fs";
import path from "path";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const userLang = {};
const history = {};

// ---------------- LANGS ----------------
const langMap = {
  es: { label: "Испанский", flag: "🇪🇸" },
  it: { label: "Итальянский", flag: "🇮🇹" },
  de: { label: "Немецкий", flag: "🇩🇪" }
};

// ---------------- TRANSLATE ----------------
async function translate(text, lang) {
  try {
    const res = await axios.get(
      "https://translate.googleapis.com/translate_a/single",
      {
        params: {
          client: "gtx",
          sl: "ru",
          tl: lang,
          dt: "t",
          q: text
        }
      }
    );

    return res.data?.[0]?.map(x => x[0]).join("") || text;
  } catch {
    return "ошибка перевода";
  }
}

async function translateBack(text, lang) {
  try {
    const res = await axios.get(
      "https://translate.googleapis.com/translate_a/single",
      {
        params: {
          client: "gtx",
          sl: lang,
          tl: "ru",
          dt: "t",
          q: text
        }
      }
    );

    return res.data?.[0]?.map(x => x[0]).join("") || text;
  } catch {
    return "ошибка перевода";
  }
}

// ---------------- MENU ----------------
function getMenu(chatId) {
  const lang = userLang[chatId] || "es";
  const cur = langMap[lang];

  return {
    text:
      `👋 Переводчик\n\n` +
      `🌍 Язык: ${cur.flag} ${cur.label}\n\n` +
      `Отправь текст или голос`,
    keyboard: Markup.inlineKeyboard([
      [Markup.button.callback("🇪🇸 Испанский", "es")],
      [Markup.button.callback("🇮🇹 Итальянский", "it")],
      [Markup.button.callback("🇩🇪 Немецкий", "de")]
    ])
  };
}

// ---------------- HISTORY ----------------
function saveHistory(chatId, ru, translated, lang) {
  if (!history[chatId]) history[chatId] = [];
  history[chatId].push({ ru, translated, lang });
}

// ---------------- VOICE DOWNLOAD ----------------
async function downloadVoice(ctx) {
  const fileId = ctx.message.voice.file_id;
  const file = await ctx.telegram.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

  const filePath = path.resolve("./voice.ogg");
  const writer = fs.createWriteStream(filePath);

  const response = await axios({ url, method: "GET", responseType: "stream" });
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(filePath));
    writer.on("error", reject);
  });
}

// ---------------- SIMPLE FREE ASR ----------------
// ВАЖНО: это НЕ идеал, но стабильно
async function speechToText(filePath) {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));

    const res = await axios.post(
      "https://api.assemblyai.com/v2/upload",
      fs.createReadStream(filePath),
      {
        headers: {
          authorization: process.env.ASSEMBLYAI_KEY,
          "content-type": "application/octet-stream"
        }
      }
    );

    const uploadUrl = res.data.upload_url;

    const transcript = await axios.post(
      "https://api.assemblyai.com/v2/transcript",
      {
        audio_url: uploadUrl
      },
      {
        headers: {
          authorization: process.env.ASSEMBLYAI_KEY
        }
      }
    );

    const id = transcript.data.id;

    // polling
    while (true) {
      const poll = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${id}`,
        {
          headers: {
            authorization: process.env.ASSEMBLYAI_KEY
          }
        }
      );

      if (poll.data.status === "completed") return poll.data.text;
      if (poll.data.status === "error") return null;

      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.log(e);
    return null;
  }
}

// ---------------- START ----------------
bot.start(async (ctx) => {
  const m = getMenu(ctx.chat.id);
  await ctx.reply(m.text, m.keyboard);
});

// ---------------- LANG ----------------
async function setLang(ctx, lang) {
  userLang[ctx.chat.id] = lang;
  const m = getMenu(ctx.chat.id);

  await ctx.reply("✔ язык изменён");
  await ctx.reply(m.text, m.keyboard);
}

bot.action("es", (ctx) => setLang(ctx, "es"));
bot.action("it", (ctx) => setLang(ctx, "it"));
bot.action("de", (ctx) => setLang(ctx, "de"));

// ---------------- TEXT ----------------
bot.on("text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;

  const lang = userLang[ctx.chat.id] || "es";
  const translated = await translate(ctx.message.text, lang);

  saveHistory(ctx.chat.id, ctx.message.text, translated, lang);

  await ctx.reply(`\`${translated}\``, {
    parse_mode: "Markdown",
    reply_markup: Markup.inlineKeyboard([
      [
        Markup.button.callback("🔁 Обратно", "back"),
        Markup.button.callback("📜 История", "history")
      ]
    ]).reply_markup
  });
});

// ---------------- VOICE ----------------
bot.on("voice", async (ctx) => {
  try {
    await ctx.reply("⏳ Обрабатываю голос...");

    const filePath = await downloadVoice(ctx);
    const text = await speechToText(filePath);

    if (!text) {
      return ctx.reply("❌ Не удалось распознать голос");
    }

    const lang = userLang[ctx.chat.id] || "es";
    const translated = await translate(text, lang);

    saveHistory(ctx.chat.id, text, translated, lang);

    await ctx.reply(`🎤 ${text}\n\n\`${translated}\``, {
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback("🔁 Обратно", "back"),
          Markup.button.callback("📜 История", "history")
        ]
      ]).reply_markup
    });
  } catch (e) {
    console.log(e);
    ctx.reply("❌ ошибка голосового");
  }
});

// ---------------- BACK ----------------
bot.action("back", async (ctx) => {
  const chatId = ctx.chat.id;
  const last = history[chatId]?.slice(-1)[0];

  if (!last) return ctx.reply("нет истории");

  const back = await translateBack(last.translated, last.lang);

  await ctx.reply(`\`${back}\``, { parse_mode: "Markdown" });
});

// ---------------- HISTORY ----------------
bot.action("history", async (ctx) => {
  const chatId = ctx.chat.id;
  const items = history[chatId] || [];

  if (!items.length) return ctx.reply("история пустая");

  const text = items
    .slice(-5)
    .reverse()
    .map((x, i) => `${i + 1}) ${x.ru} → ${x.translated}`)
    .join("\n\n");

  await ctx.reply(text);
});

bot.launch();
console.log("Bot started");
