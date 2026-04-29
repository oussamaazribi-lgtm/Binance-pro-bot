const axios = require('axios');
const dotenv = require('dotenv');

try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile',
  SYMBOLS: [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'PEPEUSDT', 
    'DOGEUSDT', 'SHIBUSDT', 'BONKUSDT', 'GALAUSDT', 'FETUSDT', 
    'LUNCUSDT', 'NOTUSDT', 'WIFUSDT', 'JUPUSDT', 'FLOKIUSDT'
  ]
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);

/**
 * 1. جلب بيانات السوق (مضمون 100% من GitHub)
 */
async function getMarketData() {
  LOG('سوق', 'جاري رصد أسعار العملات والسيولة اللحظية...');
  const results = [];
  const requests = CONFIG.SYMBOLS.map(symbol => {
    const url = `https://api.binance.us/api/v3/ticker/24hr?symbol=${symbol}`;
    return axios.get(url, { timeout: 8000 }).catch(() => null);
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
  return results.length > 0 ? results : null;
}

/**
 * 2. حل مشكلة الأخبار: جلب الأخبار بنظام الروابط المستقرة
 */
async function getDetailedNews() {
  const newsEndpoints = [
    'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&extraParams=BinanceBot',
    'https://api.coingecko.com/api/v3/news' // مصدر بديل في حال تعطل الأول
  ];

  for (const url of newsEndpoints) {
    try {
      LOG('أخبار', `محاولة جلب المستجدات من مصدر مستقر...`);
      const res = await axios.get(url, { timeout: 10000 });
      const newsData = res.data?.Data || res.data?.data; // دعم الصيغتين
      if (newsData && newsData.length > 0) {
        LOG('أخبار', '✅ تم جلب الأخبار بنجاح!');
        return newsData.slice(0, 3).map(n => ({ 
          title: n.title, 
          summary: (n.body || n.description || "").substring(0, 200) 
        }));
      }
    } catch (e) {
      continue; // الانتقال للمصدر التالي عند الفشل
    }
  }
  LOG_E('أخبار', 'تعذر الوصول للمصادر؛ سيتم التحليل بناءً على اتجاه السعر (Price Action).');
  return null;
}

/**
 * 3. صياغة المحتوى (بأسلوب بشري متغير تماماً)
 */
async function generateAIContent(marketData, news) {
  if (!marketData) return null;

  const styles = [
    "محلل متمرد يبحث عن الـ Alpha خارج الصندوق.",
    "صائد صفقات سريع يركز على اقتناص الفرص قبل الجميع.",
    "خبير استراتيجي هادئ يقرأ ما بين السطور في حركة البيتكوين والسيولة.",
    "محلل رقمي يربط بين الأخبار العاجلة وحركة الأسعار اللحظية."
  ];
  const randomStyle = styles[Math.floor(Math.random() * styles.length)];

  const prompt = `أنت محلل كريبتو (إنسان) مشهور على Binance Square. 
  البيانات الحالية: ${JSON.stringify(marketData)}
  الأخبار العاجلة: ${news ? JSON.stringify(news) : "لا توجد أخبار، ركز على انفجار السيولة وحركة الأسعار."}
  
  المطلوب منك:
  1. اكتب بأسلوب [${randomStyle}]. غير مقدمتك وخاتمتك في كل مرة.
  2. لا تلتزم بقالب ثابت. ابدأ بسؤال، أو ملاحظة غريبة، أو تحليل سريع لحركة $BTC.
  3. ركز على عملات الـ Alpha (أقل من 1 دولار) وكأنك تتحدث مع أصدقائك المتداولين.
  4. اربط الأخبار (إن وجدت) بحركة السعر. إذا كان هناك خبر إيجابي وسعر هابط، فسر ذلك (Buy the rumor, sell the news).
  5. التنسيق: Cashtags، إيموجي متنوع، فقرات غير مرتبة تبدو كأنها كتبت يدوياً.
  6. ممنوع: النجوم (***)، الكلمات المترجمة آلياً، أو تكرار نفس الهيكل.
  
  اللغة: عربية فصحى طبيعية وقوية.`;

  try {
    LOG('AI', `جاري صياغة المقال بأسلوب: ${randomStyle}`);
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        top_p: 1
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
 * 4. النشر على Binance Square
 */
async function publishToBinance(content) {
  try {
    LOG('نشر', 'إرسال التقرير إلى Binance Square...');
    const articleTitle = "رادار Alpha اللحظي 🚀";

    await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { title: articleTitle, content: content, type: "ARTICLE", language: "ar" },
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY, 'Content-Type': 'application/json' } }
    );
    LOG('نشر', '✅ مبروك! تم النشر بنجاح وبأسلوب جديد.');
  } catch (e) {
    LOG_E('نشر', `فشل النشر: ${e.response?.data?.message || e.message}`);
  }
}

async function run() {
  console.log(`\n--- دورة Binance Square: ${new Date().toLocaleString()} ---`);
  const market = await getMarketData();
  const news = await getDetailedNews();
  if (market) {
    const post = await generateAIContent(market, news);
    if (post) await publishToBinance(post);
  }
}

run();
