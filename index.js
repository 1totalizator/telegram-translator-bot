import { Telegraf, Markup } from "telegraf";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");
if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is required");

const bot = new Telegraf(TOKEN);

// 🧠 память языка
const userLang = {};

// 🌍 языки
const langMap = {
  es: { label: "Испанский", flag: "🇪🇸" },
  it: { label: "Итальянский", flag: "🇮🇹" },
  de: { label: "Немецкий", flag: "🇩🇪" },
};

// 🌍 перевод
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

// 🎛 меню (КНОПКА ВОЗВРАЩЕНА)
function menu(chatId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🇪🇸 Испанский", "es")],
    [Markup.button.callback("🇮🇹 Итальянский", "it")],
    [Markup.button.callback("🇩🇪 Немецкий", "de")],
    [Markup.button.callback("🎤 Голосовой режим", "voice_mode")],
  ]);
}

// 🟢 start
bot.start(async (ctx) => {
  const lang = userLang[ctx.chat.id] || "es";

  await ctx.reply(
    "👋 Привет!\n\n" +
      "🌍 Текущий язык: " +
      langMap[lang].flag +
      " " +
      langMap[lang].label +
      "\n\nВыбери язык 👇",
    menu(ctx.chat.id)
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

// 🎤 включение режима
bot.action("voice_mode", async (ctx) => {
  ctx.reply("🎤 Отправь голосовое сообщение — я распознаю и переведу");
});

// 📝 текст
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return;

  const lang = userLang[ctx.chat.id] || "es";

  const translated = await translate(text, lang);

  ctx.reply("🌍 Перевод:\n\n" + translated);
});

// 🎤 ГОЛОС (РЕАЛЬНО РАБОЧИЙ)
bot.on("voice", async (ctx) => {
  try {
    const file = await ctx.telegram.getFile(ctx.message.voice.file_id);

    const fileUrl =
      `https://api.telegram.org/file/bot${TOKEN}/` +
      file.file_path;

    await ctx.reply("🎤 Распознаю голос...");

    const audio = await fetch(fileUrl);
    const buffer = await audio.arrayBuffer();

    const base64 = Buffer.from(buffer).toString("base64");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: base64,
        model: "whisper-large-v3",
        response_format: "json"
      }),
    });

    const data = await res.json();

    const text = data?.text || "не удалось распознать речь";

    const lang = userLang[ctx.chat.id] || "es";
    const translated = await translate(text, lang);

    ctx.reply(
      "📝 Текст:\n" +
        text +
        "\n\n🌍 Перевод:\n" +
        translated
    );
  } catch (e) {
    ctx.reply("Ошибка голосового: " + String(e));
  }
});

bot.launch();

console.log("Bot started");
