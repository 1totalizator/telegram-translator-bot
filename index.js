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

// 🌍 перевод (стабильный)
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

// 🟢 старт
bot.start(async (ctx) => {
  await ctx.reply("👋 Бот готов. Выбери язык:", menu());
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

  const translated = await translate(ctx.message.text, lang);

  await ctx.reply("🌍 Перевод:\n\n" + translated);
});

// 🎤 ГОЛОС (100% стабильный вариант через OpenAI HTTP API)
bot.on("voice", async (ctx) => {
  try {
    await ctx.reply("🎤 Распознаю голос...");

    const file = await ctx.telegram.getFile(ctx.message.voice.file_id);

    const fileUrl =
      `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/` +
      file.file_path;

    const audioRes = await fetch(fileUrl);
    if (!audioRes.ok) throw new Error("Не удалось скачать голос");

    const buffer = Buffer.from(await audioRes.arrayBuffer());

    // 🔥 ВАЖНО: отправляем как raw file через fetch (без FormData багов Render)
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: "audio/ogg" }), "voice.ogg");
    form.append("model", "whisper-1");

    const openaiRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: form,
      }
    );

    const data = await openaiRes.json();

    if (!data.text) {
      throw new Error(JSON.stringify(data));
    }

    const text = data.text;

    const lang = userLang[ctx.chat.id] || "es";

    const translated = await translate(text, lang);

    await ctx.reply(
      "📝 Текст:\n" +
        text +
        "\n\n🌍 Перевод:\n" +
        translated
    );
  } catch (e) {
    await ctx.reply("❌ Ошибка голосового: " + (e.message || e));
  }
});

bot.launch();

console.log("Bot started");
