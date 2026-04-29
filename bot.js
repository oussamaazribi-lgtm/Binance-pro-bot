const axios = require('axios');
const dotenv = require('dotenv');

// تحميل الإعدادات من ملف .env (للتشغيل المحلي)
try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile',
  // قائمة موسعة تضم القيادية + الميم + العملات الرخيصة الرائجة (Alpha) لتفادي حظر 451
  SYMBOLS: [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 
    'PEPEUSDT', 'DOGEUSDT', 'SHIBUSDT', 'FLOKIUSDT', 'BONKUSDT', 
    'GALAUSDT', 'NEARUSDT', 'FETUSDT', 'LUNCUSDT', 'STXUSDT', 
    'ORDIUSDT', 'SATSUSDT', 'PYTHUSDT', 'TIAUSDT', 'JUPUSDT',
    'WIFUSDT', 'NOTUSDT', 'ARBUSDT', 'OPUSDT'
  ]
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);

/**
 * 1. جلب بيانات السوق الحقيقية (طريقة الطلب المحدد لتجنب الحظر الجغرافي)
 */
async function getMarketData() {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(CONFIG.SYMBOLS)}`;

  try {
    LOG('رادار', 'جاري جلب بيانات العملات المختارة (القيادية + Alpha)...');
    const res = await axios.get(url, { timeout: 10000 });
    const data = res.data;

    if (data && Array.isArray(data)) {
      return data.map(d => ({
        symbol: d.symbol.replace('USDT', ''),
        price: parseFloat(d.lastPrice) < 0.001 ? d.lastPrice : parseFloat(d.lastPrice).toLocaleString('en-US'),
        change: parseFloat(d.priceChangePercent).toFixed(2),
        volume: (parseFloat(d.quoteVolume) / 1000000).toFixed(2) + 'M',
        isAlpha: parseFloat(d.lastPrice) < 1.0,
        high: parseFloat(d.highPrice).toLocaleString(),
        low: parseFloat(d.lowPrice).toLocaleString()
      }));
    }
  } catch (e) {
    LOG_E('رادار', `فشل الجلب من الرابط الرئيسي: ${e.message}`);
    // محاولة أخيرة عبر رابط بديل
    try {
        const fallbackUrl = `https://api3.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(CONFIG.SYMBOLS)}`;
        const res = await axios.get(fallbackUrl);
        return res.data.map(d => ({ symbol: d.symbol.replace('USDT', ''), price: d.lastPrice, change: d.priceChangePercent }));
    } catch (e2) { return null; }
  }
  return null;
}

/**
 * 2. جلب أخبار حقيقية مفصلة
 */
async function getDetailedNews() {
  try {
    LOG('أخبار', 'سحب آخر مستجدات السوق...');
    const res = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN', { timeout: 10000 });
    
    if (res.data && res.data.Data) {
      return res.data.Data.slice(0, 3).map(n => ({
        title: n.title,
        summary: n.body
      }));
    }
  } catch (e) {
    LOG_E('أخبار', 'فشل جلب الأخبار، سنعتمد على تحليل حركة السيولة.');
  }
  return null;
}

/**
 * 3. توليد المحتوى الاحترافي باستخدام Groq (Alpha Hunter Mode)
 */
async function generateAIContent(marketData, news) {
  if (!marketData) return null;

  const prompt = `أنت خبير "Alpha Hunter" ومحلل تقني رائد على Binance Square في أبريل 2026.
  
  بيانات الرادار اللحظية: ${JSON.stringify(marketData)}
  أخبار السوق: ${news ? JSON.stringify(news) : "لا توجد أخبار عاجلة، ركز على انفجار السيولة وحركة السعر."}
  
  المطلوب:
  1. حلل أداء العملات البديلة (Altcoins) المذكورة، خاصة تلك التي سعرها أقل من 1 دولار ووصفها كفرص "Alpha".
  2. اربط حركة البيتكوين $BTC بالنشاط الموجود في العملات الرائجة.
  3. التنسيق: استخدم Cashtags (مثل $SOL)، فقرات جذابة، وإيموجي احترافي (🔥, 📊, 🚀).
  4. ممنوع النجوم (***) أو إخلاء المسؤولية التقليدي.
  5. الخاتمة: رادار التوقع لاتجاه السوق القادم.
  
  اللغة: عربية فصحى عصرية وقوية.`;

  try {
    LOG('AI', 'جاري صياغة التقرير الفني عبر Groq...');
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6
      },
      { headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEY}`, 'Content-Type': 'application/json' } }
    );

    let text = response.data?.choices?.[0]?.message?.content;
    return text.replace(/\*/g, '').trim();
  } catch (e) {
    LOG_E('AI', `فشل توليد المحتوى: ${e.message}`);
  }
  return null;
}

/**
 * 4. النشر على Binance Square
 */
async function publishToBinance(content) {
  try {
    LOG('نشر', 'إرسال المقال إلى Binance Square...');
    await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { bodyTextOnly: content },
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY } }
    );
    LOG('نشر', '✅ تم النشر بنجاح!');
  } catch (e) {
    LOG_E('نشر', `فشل النشر: ${e.message}`);
  }
}

/**
 * التشغيل الرئيسي
 */
async function run() {
  console.log(`\n--- دورة الرادار: ${new Date().toLocaleString()} ---`);
  
  const market = await getMarketData();
  const news = await getDetailedNews();
  
  if (market && market.length > 0) {
    const post = await generateAIContent(market, news);
    if (post) await publishToBinance(post);
  } else {
    LOG_E('نظام', 'تعذر جلب بيانات السوق، تم إيقاف الدورة للمصداقية.');
  }
}

run();
