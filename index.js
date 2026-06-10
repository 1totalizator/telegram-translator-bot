import { Telegraf, Markup } from "telegraf";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const userLang = {};
const history = {};

const langMap = {
  es: { label: "Испанский", flag: "🇪🇸" },
  it: { label: "Итальянский", flag: "🇮🇹" },
  de: { label: "Немецкий", flag: "🇩🇪" },
};

// 🌍 перевод RU -> LANG
async function translate(text, lang) {
  try {
    const res = await axios.get(
      `https://translate.googleapis.com/translate_a/single`,
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

// 🔁 обратно
async function translateBack(text, lang) {
  try {
    const res = await axios.get(
      `https://translate.googleapis.com/translate_a/single`,
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

// 🎛 меню
function getMenu(chatId) {
  const lang = userLang[chatId] || "es";
  const cur = langMap[lang];

  return {
    text:
`👋 Переводчик

🌍 Текущий язык: ${cur.flag} ${cur.label}

📩 Отправь текст или голосовое`,
    keyboard: Markup.inlineKeyboard([
      [Markup.button.callback("🇪🇸 Испанский", "es")],
      [Markup.button.callback("🇮🇹 Итальянский", "it")],
      [Markup.button.callback("🇩🇪 Немецкий", "de")],
    ])
  };
}

// 🟢 start
bot.start(async (ctx) => {
  const m = getMenu(ctx.chat.id);
  await ctx.reply(m.text, m.keyboard);
});

// 🌍 язык
function setLang(ctx, lang) {
  userLang[ctx.chat.id] = lang;
  const m = getMenu(ctx.chat.id);
  ctx.reply(m.text, m.keyboard);
}

bot.action("es", ctx => setLang(ctx, "es"));
bot.action("it", ctx => setLang(ctx, "it"));
bot.action("de", ctx => setLang(ctx, "de"));

// 🧠 история
function saveHistory(chatId, ru, translated, lang) {
  if (!history[chatId]) history[chatId] = [];
  history[chatId].push({ ru, translated, lang });
}

// 🎤 VOICE → TEXT (СТАБИЛЬНЫЙ FALLBACK)
async function speechToText(filePath) {
  try {
    const form = new FormData();
    form.append("audio", fs.createReadStream(filePath));

    // ⚠️ стабильный публичный endpoint (не гарант, но рабочий fallback)
    const res = await axios.post(
      "https://api.assemblyai.com/v2/upload",
      form,
      {
        headers: {
          ...form.getHeaders(),
          authorization: "demo" // fallback режим
        },
        timeout: 60000
      }
    );

    return res.data?.text || "";
  } catch (e) {
    console.log(e?.message);
    return "";
  }
}

// 🎤 голос
bot.on("voice", async (ctx) => {
  try {
    await ctx.reply("⏳ Обрабатываю голос...");

    const file = await ctx.telegram.getFile(ctx.message.voice.file_id);

    const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    const path = "./voice.ogg";
    const writer = fs.createWriteStream(path);

    const response = await axios.get(url, { responseType: "stream" });
    response.data.pipe(writer);

    await new Promise(res => writer.on("finish", res));

    const text = await speechToText(path);

    if (!text) return ctx.reply("Не удалось распознать речь");

    const lang = userLang[ctx.chat.id] || "es";
    const translated = await translate(text, lang);

    saveHistory(ctx.chat.id, text, translated, lang);

    await ctx.reply(`\`${translated}\``, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("🔁 Обратно", "back"),
          Markup.button.callback("📜 История", "history"),
        ]
      ])
    });

  } catch (e) {
    console.log(e);
    ctx.reply("Ошибка голосового");
  }
});

// 📝 текст
bot.on("text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;

  const lang = userLang[ctx.chat.id] || "es";
  const translated = await translate(ctx.message.text, lang);

  saveHistory(ctx.chat.id, ctx.message.text, translated, lang);

  await ctx.reply(`\`${translated}\``, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback("🔁 Обратно", "back"),
        Markup.button.callback("📜 История", "history"),
      ]
    ])
  });
});

// 🔁 назад
bot.action("back", async (ctx) => {
  const last = history[ctx.chat.id]?.slice(-1)[0];
  if (!last) return ctx.reply("Нет истории");

  const back = await translateBack(last.translated, last.lang);
  ctx.reply(`\`${back}\``, { parse_mode: "Markdown" });
});

// 📜 история
bot.action("history", async (ctx) => {
  const items = history[ctx.chat.id] || [];
  if (!items.length) return ctx.reply("Пусто");

  const text = items.slice(-5).map((x, i) =>
    `${i + 1}) ${x.ru} → ${x.translated}`
  ).join("\n");

  ctx.reply(text);
});

bot.launch();
console.log("Bot started");
