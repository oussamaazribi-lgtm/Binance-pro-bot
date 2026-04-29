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
 * 1. جلب بيانات السوق
 */
async function getMarketData() {
  LOG('سوق', 'رصد السيولة والأسعار...');
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
  return results;
}

/**
 * 2. حل مشكلة الأخبار (إصدار الحماية القصوى)
 */
async function getDetailedNews() {
  // استخدام وكيل (Proxy) بسيط أو روابط RSS مفتوحة
  const backupSources = [
    'https://cryptopanic.com/api/v1/posts/?kind=news&public=true', // مصدر مفتوح جزئياً
    'https://min-api.cryptocompare.com/data/v2/news/?lang=EN'
  ];

  for (const url of backupSources) {
    try {
      LOG('أخبار', `جلب المستجدات من ${url.includes('cryptopanic') ? 'CryptoPanic' : 'CryptoCompare'}...`);
      const res = await axios.get(url, { 
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      
      const data = res.data?.Data || res.data?.results;
      if (data && data.length > 0) {
        LOG('أخبار', '✅ تم الاتصال بمصدر الأخبار!');
        return data.slice(0, 3).map(n => ({ title: n.title, summary: (n.body || n.metadata?.description || "").substring(0, 200) }));
      }
    } catch (e) {
      continue;
    }
  }

  LOG_E('أخبار', 'تم حظر طلبات الأخبار من الخادم الحالي؛ تفعيل المحلل الداخلي.');
  return null;
}

/**
 * 3. صياغة المحتوى (الأسلوب البشري المتغير)
 */
async function generateAIContent(marketData, news) {
  if (!marketData) return null;

  const styles = [
    "محلل متمرد يكره التقليد ويركز على صيد الـ Alpha.",
    "خبير استراتيجي هادئ يحلل حركة الحيتان والسيولة.",
    "متداول يومي سريع يتحدث بلغة الأرقام والفرص العاجلة.",
    "صديق مقرب ينصح المتابعين بأهم التحركات اللحظية."
  ];
  const randomStyle = styles[Math.floor(Math.random() * styles.length)];

  const prompt = `أنت محلل كريبتو بشري محترف على Binance Square. 
  البيانات: ${JSON.stringify(marketData)}
  الأخبار: ${news ? JSON.stringify(news) : "لا توجد أخبار خارجية؛ اعتمد كلياً على تحليل الأسعار والسيولة اللحظية واستنتج اتجاه السوق بنفسك."}
  
  المطلوب:
  1. تقمص شخصية [${randomStyle}]. ابدأ المنشور بطريقة مختلفة تماماً عن المرة السابقة (سؤال عاجل، ملاحظة ساخرة، أو تحليل تقني).
  2. لا تكرر القوالب. تحدث عن $BTC ثم انتقل لعملات الـ Alpha (تحت 1 دولار).
  3. إذا لم تتوفر أخبار، ابدأ بـ "بعيداً عن ضجيج الأخبار، الأرقام اليوم تخبرنا بـ..." أو "السيولة هي الخبر الوحيد الذي يهمنا الآن...".
  4. التنسيق: Cashtags، إيموجي، فقرات غير منتظمة، بدون نجوم (***).
  5. اللغة: عربية فصحى بيضاء طبيعية.`;

  try {
    LOG('AI', `التوليد بأسلوب: ${randomStyle}`);
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.95 // رفع الإبداع لأقصى درجة
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
    LOG('نشر', 'إرسال المقال إلى Binance Square...');
    await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { title: "رادار Alpha اللحظي 🚀", content: content, type: "ARTICLE", language: "ar" },
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY, 'Content-Type': 'application/json' } }
    );
    LOG('نشر', '✅ تم النشر بنجاح بأسلوب بشري متجدد.');
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
