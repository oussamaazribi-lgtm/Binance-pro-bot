const axios = require('axios');
const dotenv = require('dotenv');

try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile',
  // القائمة المختارة لتحليل الـ Alpha والعملات البديلة
  SYMBOLS: [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'PEPEUSDT', 
    'DOGEUSDT', 'SHIBUSDT', 'BONKUSDT', 'GALAUSDT', 'FETUSDT', 
    'LUNCUSDT', 'NOTUSDT', 'WIFUSDT', 'JUPUSDT', 'FLOKIUSDT'
  ]
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);

/**
 * 1. جلب بيانات السوق (طلبات فردية لضمان الاستقرار من GitHub)
 */
async function getMarketData() {
  LOG('سوق', 'جاري جلب الأسعار والبيانات اللحظية...');
  const results = [];

  const requests = CONFIG.SYMBOLS.map(symbol => {
    const url = `https://api.binance.us/api/v3/ticker/24hr?symbol=${symbol}`;
    return axios.get(url, { timeout: 7000 }).catch(() => null);
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
    LOG('سوق', `✅ تم تحديث ${results.length} عملة.`);
    return results;
  }
  return null;
}

/**
 * 2. جلب نبض الأخبار
 */
async function getDetailedNews() {
  try {
    const res = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN', { timeout: 8000 });
    if (res.data?.Data) {
      return res.data.Data.slice(0, 3).map(n => ({ title: n.title, summary: n.body.substring(0, 200) }));
    }
  } catch (e) {
    LOG_E('أخبار', 'تحليل رقمي فقط لهذه الدورة.');
  }
  return null;
}

/**
 * 3. صياغة المحتوى (Alpha Hunter Style)
 */
async function generateAIContent(marketData, news) {
  if (!marketData) return null;

  const prompt = `أنت خبير كريبتو ومحلل تقني (Alpha Hunter) على منصة Binance Square.
  البيانات: ${JSON.stringify(marketData)}
  الأخبار: ${news ? JSON.stringify(news) : "ركز على السيولة وحركة السعر."}
  
  المطلوب:
  1. حلل أداء السوق مع التركيز على فرص العملات البديلة (Altcoins) تحت 1 دولار.
  2. التنسيق: استخدم Cashtags (مثل $SOL)، إيموجي احترافي، وفقرات منظمة.
  3. ممنوع تماماً استخدام النجوم (***) أو إخلاء المسؤولية.
  4. اللغة: عربية فصحى عصرية قوية.
  5. لا تضع عنواناً، سيتم توليده برمجياً.`;

  try {
    LOG('AI', 'جاري معالجة التحليل الفني...');
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
 * 4. النشر الفوري (OpenAPI المحدث)
 */
async function publishToBinance(content) {
  try {
    LOG('نشر', 'إرسال المحتوى إلى Binance Square...');
    
    const articleTitle = "رادار Alpha: تحليل العملات البديلة والسيولة اللحظية 🚀";

    await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { 
        title: articleTitle,
        content: content,
        type: "ARTICLE", 
        language: "ar"
      },
      { 
        headers: { 
          'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY,
          'Content-Type': 'application/json'
        } 
      }
    );
    LOG('نشر', '✅ تم النشر بنجاح على Binance Square!');
  } catch (e) {
    LOG_E('نشر', `خطأ: ${e.response?.data?.message || e.message}`);
  }
}

async function run() {
  console.log(`\n--- تحديث Binance Square: ${new Date().toLocaleString()} ---`);
  const market = await getMarketData();
  const news = await getDetailedNews();
  
  if (market) {
    const post = await generateAIContent(market, news);
    if (post) {
      await publishToBinance(post);
    }
  }
}

run();
