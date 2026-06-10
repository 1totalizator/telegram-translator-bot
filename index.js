import { Telegraf, Markup } from "telegraf";
import fs from "fs";
import fsp from "fs/promises";
import fetch from "node-fetch";
import vosk from "vosk";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const userLang = {};
const history = {};

const langMap = {
  es: { label: "Испанский", flag: "🇪🇸" },
  it: { label: "Итальянский", flag: "🇮🇹" },
  de: { label: "Немецкий", flag: "🇩🇪" }
};

// ================= TRANSLATE =================

async function translate(text, lang) {
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`
    );

    const data = await res.json();
    return data?.[0]?.map(x => x[0]).join("") || text;
  } catch {
    return "ошибка перевода";
  }
}

async function translateBack(text, lang) {
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=ru&dt=t&q=${encodeURIComponent(text)}`
    );

    const data = await res.json();
    return data?.[0]?.map(x => x[0]).join("") || text;
  } catch {
    return "ошибка перевода";
  }
}

// ================= MENU =================

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

// ================= HISTORY =================

function saveHistory(chatId, ru, translated, lang) {
  if (!history[chatId]) history[chatId] = [];
  history[chatId].push({ ru, translated, lang });
}

// ================= TEXT MESSAGE =================

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
        Markup.button.callback("📜 История", "history")
      ]
    ])
  });
});

// ================= VOICE =================

const MODEL_PATH = "./model";

if (!fs.existsSync(MODEL_PATH)) {
  console.log("Model not found!");
}

const model = new vosk.Model(MODEL_PATH);

async function speechToText(filePath) {
  return new Promise((resolve, reject) => {
    const wf = fs.createReadStream(filePath);
    const rec = new vosk.Recognizer({ model, sampleRate: 16000 });

    let resultText = "";

    wf.on("data", (chunk) => {
      if (rec.acceptWaveform(chunk)) {
        const res = rec.result();
        resultText += res.text + " ";
      }
    });

    wf.on("end", () => {
      const final = rec.finalResult();
      resultText += final.text;
      rec.free();
      resolve(resultText.trim());
    });

    wf.on("error", reject);
  });
}

bot.on("voice", async (ctx) => {
  const fileId = ctx.message.voice.file_id;

  await ctx.reply("⏳ Обрабатываю голос...");

  const file = await ctx.telegram.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

  const oggPath = "./voice.ogg";
  const wavPath = "./voice.wav";

  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(oggPath, Buffer.from(buffer));

  // ❗ конвертация через ffmpeg (обязательно на Render)
  const { execSync } = await import("child_process");
  execSync(`ffmpeg -y -i voice.ogg -ar 16000 -ac 1 voice.wav`);

  const text = await speechToText(wavPath);

  if (!text) return ctx.reply("Не распознал речь");

  const lang = userLang[ctx.chat.id] || "es";
  const translated = await translate(text, lang);

  saveHistory(ctx.chat.id, text, translated, lang);

  await ctx.reply(`🎤 ${text}\n\n\`${translated}\``, {
    parse_mode: "Markdown"
  });

  fs.unlinkSync(oggPath);
  fs.unlinkSync(wavPath);
});

// ================= BACK =================

bot.action("back", async (ctx) => {
  const last = history[ctx.chat.id]?.slice(-1)[0];
  if (!last) return ctx.reply("Нет истории");

  const back = await translateBack(last.translated, last.lang);
  await ctx.reply(`\`${back}\``, { parse_mode: "Markdown" });
});

// ================= HISTORY =================

bot.action("history", async (ctx) => {
  const items = history[ctx.chat.id] || [];
  if (!items.length) return ctx.reply("История пуста");

  const text = items
    .slice(-5)
    .reverse()
    .map((x, i) => `${i + 1}) ${x.ru} → ${x.translated}`)
    .join("\n\n");

  await ctx.reply(text);
});

// ================= LANG =================

async function setLang(ctx, lang) {
  userLang[ctx.chat.id] = lang;
  const m = getMenu(ctx.chat.id);

  await ctx.reply("✔ Язык изменён");
  await ctx.reply(m.text, m.keyboard);
}

bot.action("es", (ctx) => setLang(ctx, "es"));
bot.action("it", (ctx) => setLang(ctx, "it"));
bot.action("de", (ctx) => setLang(ctx, "de"));

bot.start((ctx) => {
  const m = getMenu(ctx.chat.id);
  ctx.reply(m.text, m.keyboard);
});

bot.launch();

console.log("Bot started");
