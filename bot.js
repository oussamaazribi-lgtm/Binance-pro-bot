const axios = require('axios');
const dotenv = require('dotenv');

try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile',
  // قائمة موسعة لجلب بيانات متنوعة (أساسية + ميم كوينز)
  SYMBOLS: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'PEPEUSDT', 'SHIBUSDT']
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);

async function getLivePrices() {
  const sources = [
    'https://api.binance.us/api/v3/ticker/24hr',
    'https://api3.binance.com/api/v3/ticker/24hr',
    'https://data-api.binance.vision/api/v3/ticker/24hr'
  ];

  for (let url of sources) {
    try {
      const res = await axios.get(url, { timeout: 10000 });
      const filtered = res.data.filter(t => CONFIG.SYMBOLS.includes(t.symbol));
      if (filtered.length > 0) return filtered.map(d => ({
        symbol: d.symbol.replace('USDT', ''),
        price: parseFloat(d.lastPrice).toLocaleString('en-US'),
        change: parseFloat(d.priceChangePercent).toFixed(2)
      }));
    } catch (e) { continue; }
  }
  return null;
}

async function generateAIContent(prices) {
  if (!prices) return null;

  // تعريف الأنماط المختلفة للمنشورات
  const patterns = [
    "تحليل فني سريع مستخدماً المؤشرات (RSI/MACD) بناءً على أداء الأسعار.",
    "تقرير 'ميم كوينز' (Memecoins) وحالة الهياج في السوق.",
    "خبر عاجل وتغطية لتقلبات السوق اللحظية.",
    "مقارنة بين أداء العملات البديلة (Altcoins) مقابل البيتكوين.",
    "توصية تعليمية للمتداولين المبتدئين بناءً على ترند السوق الحالي."
  ];
  
  const selectedPattern = patterns[Math.floor(Math.random() * patterns.length)];

  const prompt = `أنت خبير كريبتو وصانع محتوى ناري على Binance Square.
  بيانات السوق الحقيقية الآن: ${JSON.stringify(prices)}
  
  المطلوب:
  1. نمط المنشور: ${selectedPattern}
  2. التنسيق البصري: استخدم إيموجي (🚀, 📉, 🔥, 📊) و Cashtags مثل $BTC.
  3. بدلاً من إخلاء المسؤولية (بينانس تضيفه تلقائياً): أضف فقرة "رادار التوقعات" أو "إشارة فنية سريعة" (مثل: مناطق دعم/مقاومة أو تنبيه من سيولة قادمة).
  4. لغة عربية احترافية، فقرات قصيرة، بدون نجوم (***).
  5. اجعل المحتوى يبدو كأنه خبر حصري ومحين الآن.
  6. الهاشتاقات: #BinanceSquare #CryptoAnalysis #TrendingTopic.`;

  try {
    LOG('Groq', `نمط المنشور المختار: ${selectedPattern}`);
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8
      },
      { headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEY}` } }
    );

    let text = response.data?.choices?.[0]?.message?.content;
    return text.replace(/\*/g, '').trim();
  } catch (e) {
    LOG_E('Groq', e.message);
  }
  return null;
}

async function publishToBinance(content) {
  try {
    await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { bodyTextOnly: content },
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY } }
    );
    LOG('نشر', '🎉 تم النشر بنجاح بنمط جديد وبدون تكرار!');
  } catch (e) {
    LOG_E('نشر', e.message);
  }
}

async function run() {
  const livePrices = await getLivePrices();
  if (livePrices) {
    const content = await generateAIContent(livePrices);
    if (content) await publishToBinance(content);
  }
}

run();
