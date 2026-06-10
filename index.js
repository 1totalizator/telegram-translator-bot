import http from "http";
import fs from "fs";
import path from "path";
import { Telegraf, Markup } from "telegraf";
import vosk from "vosk";
import ffmpegPath from "ffmpeg-static";
import { exec } from "child_process";

// ----------------------
// Render keep-alive port
// ----------------------
http
  .createServer((req, res) => {
    res.end("bot alive");
  })
  .listen(process.env.PORT || 3000);

// ----------------------
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ----------------------
const userLang = {};
const history = {};

// ----------------------
const langMap = {
  es: { label: "Испанский", flag: "🇪🇸" },
  it: { label: "Итальянский", flag: "🇮🇹" },
  de: { label: "Немецкий", flag: "🇩🇪" }
};

// ----------------------
// TRANSLATE
// ----------------------
async function translate(text, lang) {
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=${lang}&dt=t&q=` +
        encodeURIComponent(text)
    );

    const data = await res.json();
    return data?.[0]?.map((x) => x[0]).join("") || text;
  } catch {
    return "ошибка перевода";
  }
}

// ----------------------
// VOSK MODEL
// ----------------------
const MODEL_PATH = "./model";

let model = null;

try {
  if (fs.existsSync(MODEL_PATH)) {
    vosk.setLogLevel(0);
    model = new vosk.Model(MODEL_PATH);
    console.log("✅ VOSK LOADED");
  } else {
    console.log("❌ MODEL NOT FOUND");
  }
} catch (e) {
  console.log("MODEL ERROR:", e);
}

// ----------------------
// MENU
// ----------------------
function menu(chatId) {
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

// ----------------------
// START
// ----------------------
bot.start(async (ctx) => {
  const m = menu(ctx.chat.id);
  await ctx.reply(m.text, m.keyboard);
});

// ----------------------
// LANGUAGE CHANGE
// ----------------------
async function setLang(ctx, lang) {
  userLang[ctx.chat.id] = lang;
  const m = menu(ctx.chat.id);

  await ctx.reply("✔ язык изменён");
  await ctx.reply(m.text, m.keyboard);
}

bot.action("es", (ctx) => setLang(ctx, "es"));
bot.action("it", (ctx) => setLang(ctx, "it"));
bot.action("de", (ctx) => setLang(ctx, "de"));

// ----------------------
// TEXT
// ----------------------
bot.on("text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;

  const lang = userLang[ctx.chat.id] || "es";
  const translated = await translate(ctx.message.text, lang);

  history[ctx.chat.id] = history[ctx.chat.id] || [];
  history[ctx.chat.id].push({ ru: ctx.message.text, tr: translated });

  await ctx.reply("`" + translated + "`", {
    parse_mode: "Markdown"
  });
});

// ----------------------
// VOICE FIXED VERSION
// ----------------------
bot.on("voice", async (ctx) => {
  try {
    console.log("🎤 VOICE EVENT TRIGGERED");

    await ctx.reply("🎤 Голос получен, обрабатываю...");

    const file = await ctx.telegram.getFile(ctx.message.voice.file_id);

    const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    const oggPath = "./voice.ogg";
    const wavPath = "./voice.wav";

    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());

    fs.writeFileSync(oggPath, buffer);

    console.log("📥 downloaded");

    await new Promise((resolve, reject) => {
      exec(
        `"${ffmpegPath}" -i "${oggPath}" -ar 16000 -ac 1 "${wavPath}"`,
        (err) => (err ? reject(err) : resolve())
      );
    });

    console.log("🔄 converted");

    if (!model) {
      return ctx.reply("❌ Vosk модель не загружена");
    }

    const rec = new vosk.Recognizer({
      model,
      sampleRate: 16000
    });

    const wav = fs.readFileSync(wavPath);

    rec.acceptWaveform(wav);

    const result = rec.finalResult();

    rec.free();

    const text = result?.text || "";

    console.log("🧠 recognized:", text);

    if (!text) {
      return ctx.reply("❌ не удалось распознать речь");
    }

    const lang = userLang[ctx.chat.id] || "es";
    const translated = await translate(text, lang);

    await ctx.reply(
      `🎤 ${text}\n\n\`${translated}\``,
      { parse_mode: "Markdown" }
    );

  } catch (e) {
    console.log("VOICE ERROR:", e);
    await ctx.reply("❌ ошибка голосового: " + String(e));
  }
});

// ----------------------
bot.launch();
console.log("🚀 Bot started");
