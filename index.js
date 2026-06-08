import { Telegraf, Markup } from "telegraf";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🧠 память языка
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
    return data?.[0]?.map((x) => x[0]).join("") || "ошибка перевода";
  } catch (e) {
    return "ошибка перевода: " + String(e);
  }
}

// 🎛 клавиатура
function menu(chatId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🇪🇸 Испанский", "es")],
    [Markup.button.callback("🇮🇹 Итальянский", "it")],
    [Markup.button.callback("🇩🇪 Немецкий", "de")],
  ]);
}

// 🟢 start
bot.start(async (ctx) => {
  const lang = userLang[ctx.chat.id] || "es";

  await ctx.reply(
    "👋 Привет!\n\nВыбери язык:",
    menu(ctx.chat.id)
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

// 📝 текст
bot.on("text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;

  const lang = userLang[ctx.chat.id] || "es";

  const translated = await translate(ctx.message.text, lang);

  ctx.reply("🌍 Перевод:\n\n" + translated);
});

// 🎤 ГОЛОС (СТАБИЛЬНЫЙ OPENAI WHISPER)
bot.on("voice", async (ctx) => {
  try {
    await ctx.reply("🎤 Распознаю голос...");

    const file = await ctx.telegram.getFile(ctx.message.voice.file_id);

    const fileUrl =
      `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/` +
      file.file_path;

    const audioRes = await fetch(fileUrl);
    if (!audioRes.ok) throw new Error("Не удалось скачать файл");

    const buffer = Buffer.from(await audioRes.arrayBuffer());

    const formData = new FormData();
    const blob = new Blob([buffer], { type: "audio/ogg" });

    formData.append("file", blob, "voice.ogg");
    formData.append("model", "whisper-1");

    const res = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      }
    );

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
    await ctx.reply("❌ Ошибка голосового: " + String(e.message || e));
  }
});

bot.launch();

console.log("Bot started");
