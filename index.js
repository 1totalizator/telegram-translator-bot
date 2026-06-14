import { Telegraf, Markup } from "telegraf";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ====== STATE ======
const userLang = {};
const history = {};

// ====== LANGS ======
const langMap = {
  es: { label: "Испанский", flag: "🇪🇸" },
  it: { label: "Итальянский", flag: "🇮🇹" },
  de: { label: "Немецкий", flag: "🇩🇪" }
};

// ====== TRANSLATE ======
async function translate(text, lang) {
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`
    );

    const data = await res.json();
    return data?.[0]?.map(x => x[0]).join("") || text;
  } catch (e) {
    console.log("translate error:", e);
    return "ошибка перевода";
  }
}

// ====== BACK TRANSLATE ======
async function translateBack(text, lang) {
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=ru&dt=t&q=${encodeURIComponent(text)}`
    );

    const data = await res.json();
    return data?.[0]?.map(x => x[0]).join("") || text;
  } catch (e) {
    console.log("back translate error:", e);
    return "ошибка перевода";
  }
}

// ====== MENU ======
function getMenu(chatId) {
  const lang = userLang[chatId] || "es";
  const cur = langMap[lang];

  return {
    text:
      `👋 Переводчик готов\n\n` +
      `🌍 Текущий язык: ${cur.flag} ${cur.label}\n\n` +
      `Отправь текст для перевода`,
    keyboard: Markup.inlineKeyboard([
      [Markup.button.callback("🇪🇸 Испанский", "lang_es")],
      [Markup.button.callback("🇮🇹 Итальянский", "lang_it")],
      [Markup.button.callback("🇩🇪 Немецкий", "lang_de")]
    ])
  };
}

// ====== START ======
bot.start(async (ctx) => {
  const m = getMenu(ctx.chat.id);
  await ctx.reply(m.text, m.keyboard);
});

// ====== SET LANGUAGE ======
async function setLang(ctx, lang) {
  userLang[ctx.chat.id] = lang;

  const m = getMenu(ctx.chat.id);

  await ctx.reply("✔ язык изменён");
  await ctx.reply(m.text, m.keyboard);
}

bot.action("lang_es", ctx => setLang(ctx, "es"));
bot.action("lang_it", ctx => setLang(ctx, "it"));
bot.action("lang_de", ctx => setLang(ctx, "de"));

// ====== HISTORY ======
function saveHistory(chatId, ru, translated, lang) {
  if (!history[chatId]) history[chatId] = [];
  history[chatId].push({ ru, translated, lang });
}

// ====== TEXT HANDLER ======
bot.on("text", async (ctx) => {
  if (!ctx.message?.text || ctx.message.text.startsWith("/")) return;

  const lang = userLang[ctx.chat.id] || "es";

  const translated = await translate(ctx.message.text, lang);

  saveHistory(ctx.chat.id, ctx.message.text, translated, lang);

  const formatted = `\`${translated}\``;

  await ctx.reply(formatted, {
    parse_mode: "Markdown",
    reply_markup: Markup.inlineKeyboard([
      [
        Markup.button.callback("🔁 Обратно", "back"),
        Markup.button.callback("📜 История", "history")
      ]
    ]).reply_markup
  });
});

// ====== BACK TRANSLATE ======
bot.action("back", async (ctx) => {
  const chatId = ctx.chat.id;
  const last = history[chatId]?.slice(-1)[0];

  if (!last) return ctx.reply("нет истории");

  const back = await translateBack(last.translated, last.lang);

  await ctx.reply(`\`${back}\``, { parse_mode: "Markdown" });
});

// ====== HISTORY ======
bot.action("history", async (ctx) => {
  const chatId = ctx.chat.id;
  const items = history[chatId] || [];

  if (!items.length) return ctx.reply("история пуста");

  const last = items.slice(-5).reverse();

  const text = last
    .map((x, i) => `${i + 1}) ${x.ru} → ${x.translated}`)
    .join("\n\n");

  await ctx.reply(text);
});

// ====== START BOT ======
bot.launch();
console.log("Bot started");
