import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import express from "express";

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN missing");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ===== KEEP ALIVE =====
const app = express();
app.get("/", (req, res) => res.send("OK"));
app.listen(process.env.PORT || 3000, () => {
  console.log("HTTP server running");
});

// ===== LANG STATE (простая память) =====
const userLang = new Map();

// ===== LANG BUTTONS =====
const langKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback("🇬🇧 EN", "lang_en"),
    Markup.button.callback("🇷🇺 RU", "lang_ru")
  ],
  [
    Markup.button.callback("🇺🇦 UA", "lang_uk"),
    Markup.button.callback("🇪🇸 ES", "lang_es")
  ]
]);

// ===== TRANSLATE =====
async function translate(text, target) {
  try {
    const res = await axios.post("https://libretranslate.de/translate", {
      q: text,
      source: "auto",
      target,
      format: "text"
    });

    return res.data.translatedText || text;
  } catch (e) {
    console.log("translate error:", e.message);
    return text; // никогда не падаем
  }
}

// ===== START =====
bot.start(async (ctx) => {
  userLang.set(ctx.from.id, "en");

  await ctx.reply(
    "Выбери язык перевода:",
    langKeyboard
  );
});

// ===== LANGUAGE HANDLERS =====
bot.action("lang_en", async (ctx) => {
  userLang.set(ctx.from.id, "en");
  await ctx.answerCbQuery();
  await ctx.reply("Язык: English");
});

bot.action("lang_ru", async (ctx) => {
  userLang.set(ctx.from.id, "ru");
  await ctx.answerCbQuery();
  await ctx.reply("Язык: Русский");
});

bot.action("lang_uk", async (ctx) => {
  userLang.set(ctx.from.id, "uk");
  await ctx.answerCbQuery();
  await ctx.reply("Язык: Українська");
});

bot.action("lang_es", async (ctx) => {
  userLang.set(ctx.from.id, "es");
  await ctx.answerCbQuery();
  await ctx.reply("Язык: Español");
});

// ===== TEXT HANDLER =====
bot.on("text", async (ctx) => {
  const target = userLang.get(ctx.from.id) || "en";
  const text = ctx.message.text;

  const translated = await translate(text, target);

  await ctx.reply(translated);
});

// ===== SAFE LAUNCH =====
bot.launch({
  dropPendingUpdates: true
}).then(() => {
  console.log("Bot started");
});

// ===== STOP =====
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
