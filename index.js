import { Telegraf, Markup } from "telegraf";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ===== LANGS =====
const langMap = {
  es: { label: "Испанский", flag: "🇪🇸" },
  it: { label: "Итальянский", flag: "🇮🇹" },
  de: { label: "Немецкий", flag: "🇩🇪" }
};

// память языка (очень лёгкая)
const userLang = {};

// ===== TRANSLATE =====
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

// ===== MENU TEXT =====
function menuText(chatId) {
  const lang = userLang[chatId] || "es";
  const cur = langMap[lang];

  return (
    `🤖 Переводчик\n\n` +
    `🌍 Язык: ${cur.flag} ${cur.label}\n\n` +
    `Отправь текст для перевода`
  );
}

// ===== START =====
bot.start(async (ctx) => {
  await ctx.reply(
    menuText(ctx.chat.id),
    Markup.inlineKeyboard([
      [Markup.button.callback("🇪🇸 Испанский", "es")],
      [Markup.button.callback("🇮🇹 Итальянский", "it")],
      [Markup.button.callback("🇩🇪 Немецкий", "de")]
    ])
  );
});

// ===== SET LANGUAGE =====
bot.action(["es", "it", "de"], async (ctx) => {
  userLang[ctx.chat.id] = ctx.match[0];

  await ctx.answerCbQuery("Язык изменён");

  await ctx.reply(
    menuText(ctx.chat.id),
    Markup.inlineKeyboard([
      [Markup.button.callback("🇪🇸 Испанский", "es")],
      [Markup.button.callback("🇮🇹 Итальянский", "it")],
      [Markup.button.callback("🇩🇪 Немецкий", "de")]
    ])
  );
});

// ===== TEXT HANDLER =====
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  if (!text || text.startsWith("/")) return;

  const lang = userLang[ctx.chat.id] || "es";

  const translated = await translate(text, lang);

  await ctx.reply(`\`${translated}\``, {
    parse_mode: "Markdown"
  });
});

// ===== START BOT =====
bot.launch();
console.log("Bot started");
