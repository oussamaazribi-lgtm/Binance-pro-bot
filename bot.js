const axios = require('axios');
const dotenv = require('dotenv');

// تحميل الإعدادات من ملف .env (للتشغيل المحلي)
try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile',
  // قائمة العملات لمراقبة الأداء والميم كوينز
  SYMBOLS: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'PEPEUSDT', 'DOGEUSDT']
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);

/**
 * 1. جلب بيانات السوق الحقيقية والمحينة (أسعار + حجم تداول + تغير)
 */
async function getMarketData() {
  const sources = [
    'https://api.binance.us/api/v3/ticker/24hr',
    'https://api3.binance.com/api/v3/ticker/24hr'
  ];

  for (let url of sources) {
    try {
      LOG('بيانات', `جلب الأسعار من: ${url.split('/')[2]}`);
      const res = await axios.get(url, { timeout: 10000 });
      const filtered = res.data.filter(t => CONFIG.SYMBOLS.includes(t.symbol));
      
      if (filtered.length > 0) {
        return filtered.map(d => ({
          symbol: d.symbol.replace('USDT', ''),
          price: parseFloat(d.lastPrice).toLocaleString('en-US'),
          change: parseFloat(d.priceChangePercent).toFixed(2),
          volume: (parseFloat(d.quoteVolume) / 1000000).toFixed(2) + 'M',
          high: parseFloat(d.highPrice).toLocaleString(),
          low: parseFloat(d.lowPrice).toLocaleString()
        }));
      }
    } catch (e) { continue; }
  }
  return null;
}

/**
 * 2. جلب أخبار حقيقية مفصلة (العنوان + ملخص الخبر)
 */
async function getDetailedNews() {
  try {
    LOG('أخبار', 'جاري سحب الأخبار المفصلة من مجمع CryptoCompare...');
    // المصدر يوفر ملخص كامل للخبر (Body) وليس العنوان فقط
    const res = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN', { timeout: 10000 });
    
    if (res.data && res.data.Data) {
      return res.data.Data.slice(0, 3).map(n => ({
        title: n.title,
        summary: n.body, // المحتوى الكامل للتحليل
        url: n.url
      }));
    }
  } catch (e) {
    LOG_E('أخبار', 'فشل جلب الأخبار المفصلة، سنعتمد على تحليل الأرقام فقط.');
  }
  return null;
}

/**
 * 3. توليد المحتوى باستخدام Groq بناءً على البيانات والأخبار
 */
async function generateAIContent(marketData, news) {
  if (!marketData) return null;

  // تعريف أنماط النشر لكسر الجمود والتكرار
  const patterns = [
    "تحليل 'خريطة السيولة': ركز على أحجام التداول (Volume) والزخم الحالي.",
    "رادار 'العملات البديلة والميم': قارن أداء $BTC مع $PEPE و $DOGE.",
    "تحديث 'القمة والقاع': اذكر مستويات الدعم والمقاومة بناءً على High و Low اليوم.",
    "تقرير 'الحدث والسعر': اربط الأخبار المفصلة بحركة السعر الحالية (إذا توفرت)."
  ];
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];

  const prompt = `أنت محلل أسواق محترف وصانع محتوى على Binance Square في أبريل 2026.
  
  بيانات السوق (حقيقية): ${JSON.stringify(marketData)}
  أخبار مفصلة (حقيقية): ${news ? JSON.stringify(news) : "لا توجد أخبار، ركز على السعر."}
  
  المطلوب:
  1. النمط: ${pattern}
  2. التنسيق: استخدم إيموجي (🚀, 📉, 🔥)، فقرات قصيرة، و Cashtags مثل $BTC.
  3. المحتوى: ادمج الخبر مع السعر بذكاء. إذا كان الخبر إيجابياً والسعر صاعد، حلل السبب.
  4. ممنوع النجوم (***). ممنوع إخلاء المسؤولية التقليدي (بينانس تضيفه).
  5. بدلاً من الإخلاء، أضف "إشارة فنية" أو "رادار التوقع".
  6. اللغة: عربية احترافية، جذابة، ومحينة.`;

  try {
    LOG('Groq', `بدء المعالجة بنمط: ${pattern}`);
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5 // درجة منخفضة لضمان الدقة الرقمية
      },
      { headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEY}`, 'Content-Type': 'application/json' } }
    );

    let text = response.data?.choices?.[0]?.message?.content;
    return text.replace(/\*/g, '').trim();
  } catch (e) {
    LOG_E('Groq', `فشل التوليد: ${e.message}`);
  }
  return null;
}

/**
 * 4. نشر المحتوى النهائي على Binance Square
 */
async function publishToBinance(content) {
  try {
    LOG('نشر', 'إرسال المنشور إلى Binance Square...');
    await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { bodyTextOnly: content },
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY } }
    );
    LOG('نشر', '🎉 تم النشر بنجاح! محتوى حقيقي، محين، وغير مكرر.');
  } catch (e) {
    LOG_E('نشر', `فشل النشر: ${e.message}`);
  }
}

/**
 * التشغيل الرئيسي
 */
async function run() {
  console.log(`--- دورة العمل: ${new Date().toLocaleString()} ---`);
  
  const market = await getMarketData();
  const news = await getDetailedNews();
  
  if (market) {
    const post = await generateAIContent(market, news);
    if (post) await publishToBinance(post);
  } else {
    LOG_E('نظام', 'تعذر جلب بيانات السوق، تم إيقاف الدورة للمصداقية.');
  }
}

run();
