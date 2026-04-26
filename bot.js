const axios = require('axios');
const dotenv = require('dotenv');

try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile',
  // العملات: تشمل القيادية والميم للتنوع
  SYMBOLS: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'PEPEUSDT', 'DOGEUSDT']
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);

async function getPreciseMarketData() {
  const sources = [
    'https://api.binance.us/api/v3/ticker/24hr',
    'https://api3.binance.com/api/v3/ticker/24hr'
  ];

  for (let url of sources) {
    try {
      LOG('بيانات', `جلب بيانات محينة من: ${url.split('/')[2]}`);
      const res = await axios.get(url, { timeout: 10000 });
      const filtered = res.data.filter(t => CONFIG.SYMBOLS.includes(t.symbol));
      
      if (filtered.length > 0) {
        return filtered.map(d => ({
          symbol: d.symbol.replace('USDT', ''),
          price: parseFloat(d.lastPrice),
          change: parseFloat(d.priceChangePercent).toFixed(2),
          high: parseFloat(d.highPrice).toLocaleString(),
          low: parseFloat(d.lowPrice).toLocaleString(),
          volume: (parseFloat(d.quoteVolume) / 1000000).toFixed(2) + 'M', // الحجم بالمليون دولار
          count: d.count // عدد الصفقات (مؤشر نشاط)
        }));
      }
    } catch (e) { continue; }
  }
  return null;
}

async function generateAIContent(marketData) {
  if (!marketData) return null;

  // اختيار نمط عشوائي من الأنماط الأربعة الأكثر تفاعلاً
  const patterns = [
    "تحليل 'خريطة السيولة': ركز على حجم التداول (Volume) والعملات الأكثر نشاطاً الآن.",
    "رادار العملات البديلة والميم: قارن بين أداء العملات الصغيرة مقابل البيتكوين.",
    "تحديث 'القمة والقاع': اذكر مستويات الـ High و Low للحظة لتحديد الدعم والمقاومة.",
    "تقرير 'نبض السوق العاجل': ركز على نسبة التغير (Change) السريعة والفرص المتاحة."
  ];
  const selectedPattern = patterns[Math.floor(Math.random() * patterns.length)];

  const prompt = `أنت محلل بيانات كريبتو في أبريل 2026. بياناتك مستخرجة الآن وحصرياً من Binance API:
  البيانات الحقيقية: ${JSON.stringify(marketData)}
  
  المطلوب:
  1. النمط: ${selectedPattern}
  2. التزم بالأرقام المذكورة أعلاه بدقة. إذا كان الحجم (Volume) مرتفعاً، صِفه بالزخم.
  3. الهيكل: عنوان بصري، فقرة تحليلية دقيقة، "إشارة فنية" بدلاً من إخلاء المسؤولية.
  4. لغة عربية سليمة، بدون نجوم (***)، واستخدام $Cashtags.
  5. اجعل المتابع يشعر أنك تقرأ الشاشة معه في هذه اللحظة.
  6. الهاشتاقات: #BinanceSquare #CryptoData #MarketUpdate.`;

  try {
    LOG('Groq', `بدء الصياغة بناءً على بيانات حقيقية محينة...`);
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5 // درجة منخفضة لضمان الالتزام بالأرقام ومنع الهلوسة
      },
      { headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEY}`, 'Content-Type': 'application/json' } }
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
    const res = await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { bodyTextOnly: content },
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY } }
    );
    if (res.data) LOG('نشر', '🎉 تم النشر بنجاح! المحتوى حقيقي ومحين 100%.');
  } catch (e) {
    LOG_E('نشر', `فشل النشر: ${e.message}`);
  }
}

async function run() {
  console.log(`--- دورة النشر: ${new Date().toISOString()} ---`);
  const data = await getPreciseMarketData();
  if (!data) {
    LOG_E('نظام', 'فشل جلب البيانات الحقيقية. لن يتم النشر لضمان المصداقية.');
    process.exit(1);
  }
  const post = await generateAIContent(data);
  if (post) await publishToBinance(post);
}

run();
