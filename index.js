import { Telegraf, Markup } from "telegraf";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");

const bot = new Telegraf(TOKEN);

// 🧠 память языка
const userLang = {};

// 🌍 языки
const langMap = {
  es: { label: "Испанский", flag: "🇪🇸" },
  it: { label: "Итальянский", flag: "🇮🇹" },
  de: { label: "Немецкий", flag: "🇩🇪" },
};

// 🌍 перевод (стабильный бесплатный)
async function translate(text, targetLang = "es") {
  try {
    const res = await fetch(
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=" +
        targetLang +
        "&dt=t&q=" +
        encodeURIComponent(text)
    );

    const data = await res.json();
    return data?.[0]?.map((x) => x[0]).join("") || "ошибка перевода";
  } catch (e) {
    return "ошибка API: " + String(e);
  }
}

// 🎛 меню
function menu(chatId) {
  const lang = userLang[chatId] || "es";

  return Markup.inlineKeyboard([
    [Markup.button.callback("🇪🇸 Испанский", "es")],
    [Markup.button.callback("🇮🇹 Итальянский", "it")],
    [Markup.button.callback("🇩🇪 Немецкий", "de")],
    [Markup.button.callback("🎤 Голос (эксперимент)", "voice_info")],
  ]);
}

// 🟢 start
bot.start(async (ctx) => {
  const chatId = ctx.chat.id;
  const lang = userLang[chatId] || "es";

  await ctx.reply(
    "👋 Привет!\n\n" +
      "🌍 Текущий язык: " +
      langMap[lang].flag +
      " " +
      langMap[lang].label +
      "\n\nВыбери язык 👇",
    menu(chatId)
  );
});

// 🌍 язык
bot.action("es", async (ctx) => {
  userLang[ctx.chat.id] = "es";
  await ctx.reply("🇪🇸 Испанский выбран");
});

bot.action("it", async (ctx) => {
  userLang[ctx.chat.id] = "it";
  await ctx.reply("🇮🇹 Итальянский выбран");
});

bot.action("de", async (ctx) => {
  userLang[ctx.chat.id] = "de";
  await ctx.reply("🇩🇪 Немецкий выбран");
});

// 🎤 голос (без API — просто заглушка)
bot.action("voice_info", async (ctx) => {
  await ctx.reply(
    "🎤 Голос сейчас в бесплатном режиме работает ограниченно.\n\n" +
      "👉 Чтобы он реально распознавал речь стабильно — нужен API ключ (объясню дальше)\n\n" +
      "Пока отправь голосовое — я просто покажу текстовый файл Telegram (без распознавания)."
  );
});

// 📝 текст → перевод
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return;

  const lang = userLang[ctx.chat.id] || "es";

  const translated = await translate(text, lang);

  await ctx.reply("🌍 Перевод:\n\n" + translated);
});

// 🎤 голос (Telegram voice → пока просто уведомление)
bot.on("voice", async (ctx) => {
  await ctx.reply(
    "🎤 Голос получен.\n\n⚠️ Распознавание речи требует подключения сервиса.\nСейчас бот получает файл, но не может его расшифровать без API."
  );
});

// 🚀 запуск
bot.launch();

console.log("Bot started");
