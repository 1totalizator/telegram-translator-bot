import { Telegraf, Markup } from "telegraf";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// 🧠 язык пользователя
const userLang = {};

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
function menu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🇪🇸 Испанский", "es")],
    [Markup.button.callback("🇮🇹 Итальянский", "it")],
    [Markup.button.callback("🇩🇪 Немецкий", "de")],
  ]);
}

// 🟢 старт (УЛУЧШЕННЫЙ)
bot.start(async (ctx) => {
  const lang = userLang[ctx.chat.id] || "es";

  const current = langMap[lang];

  await ctx.reply(
    `👋 Привет!

Я — твой переводчик.

📌 Что я умею:
• отправь текст → получишь перевод
• выбираешь язык кнопками ниже

🌍 Текущий язык: ${current.flag} ${current.label}

Выбери язык:`,
    menu()
  );
});

// 🌍 выбор языка
bot.action("es", (ctx) => {
  userLang[ctx.chat.id] = "es";
  ctx.reply("🇪🇸 Язык установлен: Испанский");
});

bot.action("it", (ctx) => {
  userLang[ctx.chat.id] = "it";
  ctx.reply("🇮🇹 Язык установлен: Итальянский");
});

bot.action("de", (ctx) => {
  userLang[ctx.chat.id] = "de";
  ctx.reply("🇩🇪 Язык установлен: Немецкий");
});

// 📝 текст (ЧИСТЫЙ ВЫВОД БЕЗ ЛИШНЕГО)
bot.on("text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;

  const lang = userLang[ctx.chat.id] || "es";

  const translated = await translate(ctx.message.text, lang);

  // 🔥 ВАЖНО: только текст, без "перевод:"
  await ctx.reply(translated);
});

bot.launch();

console.log("Bot started");
