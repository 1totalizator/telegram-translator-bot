import { Telegraf, Markup } from "telegraf";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// 🧠 память
const userLang = {};
const history = {};

// 🌍 языки
const langMap = {
  es: { label: "Испанский", flag: "🇪🇸" },
  it: { label: "Итальянский", flag: "🇮🇹" },
  de: { label: "Немецкий", flag: "🇩🇪" },
};

// 🌍 перевод
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

// 🎛 меню
function menu(chatId) {
  const lang = userLang[chatId] || "es";
  const cur = langMap[lang];

  return {
    text:
      `👋 Переводчик готов\n\n` +
      `🌍 Текущий язык: ${cur.flag} ${cur.label}\n\n` +
      `Отправь текст ↓`,
    keyboard: Markup.inlineKeyboard([
      [Markup.button.callback("🇪🇸 Испанский", "es")],
      [Markup.button.callback("🇮🇹 Итальянский", "it")],
      [Markup.button.callback("🇩🇪 Немецкий", "de")],
    ]),
  };
}

// 🟢 start
bot.start(async (ctx) => {
  const m = menu(ctx.chat.id);
  await ctx.reply(m.text, m.keyboard);
});

// 🌍 выбор языка (ВОЗВРАТ В МЕНЮ)
async function setLang(ctx, lang) {
  userLang[ctx.chat.id] = lang;

  const m = menu(ctx.chat.id);

  await ctx.reply(
    `✔ Язык изменён`,
    { ...m.keyboard }
  );

  await ctx.reply(m.text, m.keyboard);
}

bot.action("es", (ctx) => setLang(ctx, "es"));
bot.action("it", (ctx) => setLang(ctx, "it"));
bot.action("de", (ctx) => setLang(ctx, "de"));

// 📝 перевод
bot.on("text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;

  const lang = userLang[ctx.chat.id] || "es";

  const translated = await translate(ctx.message.text, lang);

  if (!history[ctx.chat.id]) history[ctx.chat.id] = [];
  history[ctx.chat.id].push({ ru: ctx.message.text, translated });

  // 🔥 ВАЖНО: code block = максимально удобное копирование
  await ctx.reply("```" + translated + "```", {
    parse_mode: "Markdown",
  });
});

bot.launch();

console.log("Bot started");
