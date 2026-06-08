import { Telegraf, Markup } from "telegraf";
import OpenAI from "openai";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🧠 память языка
const userLang = {};

// 🌍 языки
const langMap = {
  es: { label: "Испанский", flag: "🇪🇸" },
  it: { label: "Итальянский", flag: "🇮🇹" },
  de: { label: "Немецкий", flag: "🇩🇪" },
};

// 🌍 перевод через GPT (стабильно)
async function translate(text, lang) {
  try {
    const res = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `Переведи на ${lang}:\n\n${text}`,
    });

    return res.output_text || "ошибка перевода";
  } catch (e) {
    return "ошибка перевода: " + String(e);
  }
}

// 🎛 меню
function menu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🇪🇸 Испанский", "es")],
    [Markup.button.callback("🇮🇹 Итальянский", "it")],
    [Markup.button.callback("🇩🇪 Немецкий", "de")],
    [Markup.button.callback("🎤 Голос", "voice")],
  ]);
}

// 🟢 start
bot.start(async (ctx) => {
  const lang = userLang[ctx.chat.id] || "es";

  await ctx.reply(
    `👋 Привет!\n\n🌍 Язык: ${lang}`,
    menu()
  );
});

// 🌍 язык
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
  const result = await translate(ctx.message.text, lang);

  ctx.reply("🌍 Перевод:\n\n" + result);
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

    if (!audioRes.ok) {
      throw new Error("Не удалось скачать голос из Telegram");
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 🧠 НОРМАЛЬНЫЙ UPLOAD ДЛЯ OPENAI
    const formData = new FormData();
    const blob = new Blob([buffer], { type: "audio/ogg" });

    formData.append("file", blob, "voice.ogg");
    formData.append("model", "whisper-1");

    const transcriptionRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
      }
    );

    const data = await transcriptionRes.json();

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
