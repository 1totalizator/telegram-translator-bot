import { Telegraf, Markup } from "telegraf";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// 🧠 память
const userLang = {};
const history = {}; // chatId -> [{ru, translated, lang}]

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

// 🔁 обратный перевод
async function translateBack(text, fromLang) {
  try {
    const res = await fetch(
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
        fromLang +
        "&tl=ru&dt=t&q=" +
        encodeURIComponent(text)
    );

    const data = await res.json();
    return data?.[0]?.map((x) => x[0]).join("") || text;
  } catch {
    return "ошибка перевода";
  }
}

// 🎛 меню языков
function menu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🇪🇸 Испанский", "es")],
    [Markup.button.callback("🇮🇹 Итальянский", "it")],
    [Markup.button.callback("🇩🇪 Немецкий", "de")],
  ]);
}

// 📋 кнопки результата
function resultButtons(chatId, text, lang) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🔁 Обратно", `back:${chatId}`),
      Markup.button.callback("📜 История", `history:${chatId}`),
    ],
  ]);
}

// 🟢 start
bot.start(async (ctx) => {
  const lang = userLang[ctx.chat.id] || "es";
  const cur = langMap[lang];

  await ctx.reply(
    `👋 Переводчик готов

🌍 Текущий язык: ${cur.flag} ${cur.label}

Отправь текст ↓`,
    menu()
  );
});

// 🌍 выбор языка
bot.action("es", (ctx) => {
  userLang[ctx.chat.id] = "es";
  ctx.reply("🇪🇸 Испанский выбран");
});

bot.action("it", (ctx) => {
  userLang[ctx.chat.id] = "it";
  ctx.reply("🇮🇹 Итальянский выбран");
});

bot.action("de", (ctx) => {
  userLang[ctx.chat.id] = "de";
  ctx.reply("🇩🇪 Немецкий выбран");
});

// 📝 перевод
bot.on("text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;

  const lang = userLang[ctx.chat.id] || "es";

  const translated = await translate(ctx.message.text, lang);

  // история
  if (!history[ctx.chat.id]) history[ctx.chat.id] = [];
  history[ctx.chat.id].push({
    ru: ctx.message.text,
    translated,
    lang,
  });

  await ctx.reply(translated, resultButtons(ctx.chat.id));
});

// 🔁 ОБРАТНЫЙ ПЕРЕВОД
bot.action(/back:(.+)/, async (ctx) => {
  const chatId = ctx.match[1];

  const last = history[chatId]?.slice(-1)[0];

  if (!last) {
    return ctx.reply("Нет истории");
  }

  const back = await translateBack(last.translated, last.lang);

  await ctx.reply(back);
});

// 📜 ИСТОРИЯ
bot.action(/history:(.+)/, async (ctx) => {
  const chatId = ctx.match[1];

  const items = history[chatId] || [];

  if (!items.length) {
    return ctx.reply("История пуста");
  }

  const last5 = items.slice(-5).reverse();

  const text = last5
    .map(
      (x, i) =>
        `${i + 1}) RU: ${x.ru}\n   → ${x.translated}`
    )
    .join("\n\n");

  await ctx.reply("📜 Последние переводы:\n\n" + text);
});

bot.launch();

console.log("Bot started");
