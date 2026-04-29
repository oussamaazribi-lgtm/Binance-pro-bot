const axios = require('axios');
const dotenv = require('dotenv');

try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile',
  // القائمة الذهبية التي طلبتها (قيادية + Alpha + رخيصة)
  SYMBOLS: [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'PEPEUSDT', 
    'DOGEUSDT', 'SHIBUSDT', 'BONKUSDT', 'GALAUSDT', 'FETUSDT', 
    'LUNCUSDT', 'NOTUSDT', 'WIFUSDT', 'JUPUSDT', 'FLOKIUSDT'
  ]
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);

/**
 * 1. جلب البيانات (استراتيجية الطلبات الفردية المضمونة)
 */
async function getMarketData() {
  LOG('رادار', 'بدء جلب بيانات العملات الفردية لتجنب أخطاء الصيغة...');
  const results = [];

  // نستخدم Promise.all لطلب كل العملات في نفس اللحظة بسرعة فائقة
  const requests = CONFIG.SYMBOLS.map(symbol => {
    // نستخدم الرابط الأمريكي لأنه الأكثر استقراراً مع GitHub
    const url = `https://api.binance.us/api/v3/ticker/24hr?symbol=${symbol}`;
    return axios.get(url, { timeout: 5000 }).catch(e => null);
  });

  const responses = await Promise.all(requests);

  for (const res of responses) {
    if (res && res.data) {
      const d = res.data;
      results.push({
        symbol: d.symbol.replace('USDT', ''),
        price: parseFloat(d.lastPrice) < 0.001 ? d.lastPrice : parseFloat(d.lastPrice).toLocaleString('en-US'),
        change: parseFloat(d.priceChangePercent).toFixed(2),
        volume: (parseFloat(d.quoteVolume) / 1000000).toFixed(2) + 'M',
        isAlpha: parseFloat(d.lastPrice) < 1.0
      });
    }
  }

  if (results.length > 0) {
    LOG('رادار', `✅ نجح صيد ${results.length} عملة من السوق!`);
    return results;
  }
  
  LOG_E('رادار', 'فشلت جميع محاولات جلب العملات.');
  return null;
}

/**
 * 2. الأخبار (تحديث لرابط أكثر استقراراً)
 */
async function getDetailedNews() {
  try {
    LOG('أخبار', 'جاري جلب نبض السوق...');
    const res = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN', { timeout: 10000 });
    if (res.data?.Data) {
      return res.data.Data.slice(0, 3).map(n => ({ title: n.title, summary: n.body.substring(0, 200) }));
    }
  } catch (e) {
    LOG_E('أخبار', 'سيعتمد التحليل على البيانات الرقمية فقط.');
  }
  return null;
}

/**
 * 3. الذكاء الاصطناعي (Groq)
 */
async function generateAIContent(marketData, news) {
  if (!marketData) return null;

  const prompt = `أنت خبير "Alpha Hunter" على Binance Square. حلل هذه البيانات اللحظية:
  البيانات: ${JSON.stringify(marketData)}
  الأخبار: ${news ? JSON.stringify(news) : "ركز على السيولة."}
  
  المطلوب:
  1. سلط الضوء على العملات البديلة (Altcoins) تحت 1 دولار ووصفها كفرص Alpha.
  2. اربط حركة $BTC بالنشاط الحالي.
  3. التنسيق: Cashtags، إيموجي احترافي، بدون نجوم (***)، وبدون إخلاء مسؤولية.
  4. اللغة: عربية احترافية جذابة.`;

  try {
    LOG('AI', 'جاري معالجة المحتوى...');
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      },
      { headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEY}`, 'Content-Type': 'application/json' } }
    );
    return response.data?.choices?.[0]?.message?.content?.replace(/\*/g, '').trim();
  } catch (e) {
    LOG_E('AI', 'فشل التوليد.');
  }
  return null;
}

/**
 * 4. النشر
 */
async function publishToBinance(content) {
  try {
    LOG('نشر', 'إرسال إلى Binance Square...');
    await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { bodyTextOnly: content },
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY } }
    );
    LOG('نشر', '✅ مبروك! تم النشر بنجاح.');
  } catch (e) {
    LOG_E('نشر', `خطأ في API بينانس: ${e.message}`);
  }
}

async function run() {
  console.log(`\n--- دورة العمل: ${new Date().toLocaleString()} ---`);
  const market = await getMarketData();
  const news = await getDetailedNews();
  if (market) {
    const post = await generateAIContent(market, news);
    if (post) await publishToBinance(post);
  }
}

run();
