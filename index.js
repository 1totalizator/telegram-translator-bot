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

// 🌍 перевод (стабильный Google endpoint)
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
  ]);
}

// 🟢 старт
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

// 🌍 выбор языка
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

// 📝 текст → перевод
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return;

  const lang = userLang[ctx.chat.id] || "es";

  const translated = await translate(text, lang);

  await ctx.reply("🌍 Перевод:\n\n" + translated);
});

// 🎤 голос → текст → перевод
bot.on("voice", async (ctx) => {
  try {
    const file = await ctx.telegram.getFile(ctx.message.voice.file_id);

    const fileUrl =
      `https://api.telegram.org/file/bot${TOKEN}/` +
      file.file_path;

    await ctx.reply("🎤 Распознаю голос...");

    const audioRes = await fetch(fileUrl);
    const buffer = await audioRes.arrayBuffer();

    const form = new FormData();
    form.append("file", new Blob([buffer], { type: "audio/ogg" }));

    const res = await fetch("https://whisper.jonex.ai/asr", {
      method: "POST",
      body: form,
    });

    const data = await res.json();

    const text = data?.text || "не удалось распознать речь";

    const lang = userLang[ctx.chat.id] || "es";

    const translated = await translate(text, lang);

    await ctx.reply(
      "📝 Текст:\n" +
        text +
        "\n\n🌍 Перевод:\n" +
        translated
    );
  } catch (e) {
    await ctx.reply("Ошибка голосового: " + String(e));
  }
});

// 🚀 запуск
bot.launch();

console.log("Bot started");
