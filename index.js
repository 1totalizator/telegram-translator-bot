import http from "http";
import { Telegraf, Markup } from "telegraf";

// ✅ КОСТЫЛЬ ДЛЯ RENDER (обязательно, иначе бот будет падать)
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is running");
  })
  .listen(process.env.PORT || 3000);

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
    const res = await fetch(
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=" +
        lang +
        "&dt=t&q=" +
        encodeURIComponent(text)
    );

    const data = await res.json();
    return data?.[0]?.map((x) => x[0]).join("") || text;
  } catch {
    return "ошибка перевода";
  }
}

// 🌍 перевод обратно LANG -> RU
async function translateBack(text, lang) {
  try {
    const res = await fetch(
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
        lang +
        "&tl=ru&dt=t&q=" +
        encodeURIComponent(text)
    );

    const data = await res.json();
    return data?.[0]?.map((x) => x[0]).join("") || text;
  } catch {
    return "Ошибка перевода";
  }
}

// 🎛 меню
function getMenu(chatId) {
  const lang = userLang[chatId] || "es";
  const cur = langMap[lang];

  return {
    text:
      `👋 Переводчик\n\n` +
      `🌍 Текущий язык: ${cur.flag} ${cur.label}\n\n` +
      `Отправь текст ↓`,
    keyboard: Markup.inlineKeyboard([
      [Markup.button.callback("🇪🇸 Испанский", "es")],
      [Markup.button.callback("🇮🇹 Итальянский", "it")],
      [Markup.button.callback("🇩🇪 Немецкий", "de")],
    ]),
  };
}

// 🟢 старт
bot.start(async (ctx) => {
  const m = getMenu(ctx.chat.id);
  await ctx.reply(m.text, m.keyboard);
});

// 🌍 смена языка
async function setLang(ctx, lang) {
  userLang[ctx.chat.id] = lang;

  const m = getMenu(ctx.chat.id);

  await ctx.reply("✔ Язык изменён");
  await ctx.reply(m.text, m.keyboard);
}

bot.action("es", (ctx) => setLang(ctx, "es"));
bot.action("it", (ctx) => setLang(ctx, "it"));
bot.action("de", (ctx) => setLang(ctx, "de"));

// 🧠 история
function saveHistory(chatId, ru, translated, lang) {
  if (!history[chatId]) history[chatId] = [];
  history[chatId].push({ ru, translated, lang });
}

// 📝 перевод
bot.on("text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;

  const lang = userLang[ctx.chat.id] || "es";

  const translated = await translate(ctx.message.text, lang);

  saveHistory(ctx.chat.id, ctx.message.text, translated, lang);

  const formatted = "`" + translated + "`";

  await ctx.reply(formatted, {
    parse_mode: "Markdown",
    reply_markup: Markup.inlineKeyboard([
      [
        Markup.button.callback("🔁 Обратно", "back"),
        Markup.button.callback("📜 История", "history"),
      ],
    ]).reply_markup,
  });
});

// 🔁 обратный перевод
bot.action("back", async (ctx) => {
  const chatId = ctx.chat.id;
  const last = history[chatId]?.slice(-1)[0];

  if (!last) return ctx.reply("Нет истории");

  const back = await translateBack(last.translated, last.lang);

  await ctx.reply("`" + back + "`", {
    parse_mode: "Markdown",
  });
});

// 📜 история
bot.action("history", async (ctx) => {
  const chatId = ctx.chat.id;
  const items = history[chatId] || [];

  if (!items.length) return ctx.reply("История пуста");

  const last = items.slice(-5).reverse();

  const text = last
    .map((x, i) => `${i + 1}) ${x.ru} → ${x.translated}`)
    .join("\n\n");

  await ctx.reply(text);
});

bot.launch();

console.log("Bot started");
