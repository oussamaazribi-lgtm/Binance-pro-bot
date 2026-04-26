const axios = require('axios');
const dotenv = require('dotenv');

try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile',
  // عملات المراقبة
  SYMBOLS: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);

async function getLivePrices() {
  // استخدام عدة مصادر لضمان جلب بيانات حقيقية ومحينة
  const sources = [
    'https://api3.binance.com/api/v3/ticker/24hr',
    'https://api.binance.us/api/v3/ticker/24hr',
    'https://data-api.binance.vision/api/v3/ticker/24hr'
  ];

  for (let url of sources) {
    try {
      LOG('بيانات', `محاولة جلب الأسعار من مصدر: ${url.split('/')[2]}`);
      const res = await axios.get(url, { timeout: 10000 });
      const filtered = res.data.filter(t => CONFIG.SYMBOLS.includes(t.symbol));
      
      if (filtered.length > 0) {
        LOG('بيانات', '✅ تم جلب الأسعار الحقيقية بنجاح.');
        return filtered.map(d => ({
          symbol: d.symbol.replace('USDT', ''),
          price: parseFloat(d.lastPrice).toLocaleString('en-US'),
          change: parseFloat(d.priceChangePercent).toFixed(2)
        }));
      }
    } catch (e) {
      LOG_E('بيانات', `فشل المصدر ${url.split('/')[2]}`);
    }
  }
  return null;
}

async function generateAIContent(prices) {
  if (!prices) return null;

  const prompt = `أنت محلل أسواق محترف. إليك بيانات الأسعار الحقيقية واللحظية الآن من السوق:
  ${JSON.stringify(prices)}
  
  المطلوب:
  1. اكتب تقرير إخباري لـ Binance Square باللغة العربية.
  2. تجنب تماماً استخدام الرموز مثل النجوم الثلاثية (***) أو العلامات الغريبة. استخدم النقاط العادية أو الترقيم.
  3. اجعل الأسلوب احترافياً ومباشراً.
  4. الهيكل: عنوان، تحليل سريع للأسعار، نصيحة للمتداولين، وإخلاء مسؤولية.
  5. استخدم الهاشتاقات: #BinanceSquare #CryptoMarket #Bitcoin.`;

  try {
    LOG('Groq', 'جاري معالجة البيانات وصياغة المحتوى...');
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6 // تقليل الحرارة لضمان دقة الأرقام
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.GROQ_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let text = response.data?.choices?.[0]?.message?.content;
    // تنظيف إضافي لإزالة أي نجوم قد يضعها النموذج
    text = text.replace(/\*\*\*/g, '').replace(/\*\*/g, '');
    return text.trim();
  } catch (e) {
    LOG_E('Groq', `فشل التوليد: ${e.message}`);
  }
  return null;
}

async function publishToBinance(content) {
  try {
    LOG('نشر', 'جاري النشر على Binance Square...');
    await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { bodyTextOnly: content },
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY } }
    );
    LOG('نشر', '🎉 تم النشر بنجاح ببيانات حقيقية!');
  } catch (e) {
    LOG_E('نشر', `فشل النشر: ${e.message}`);
  }
}

async function run() {
  console.log('--- تشغيل دورة البيانات الحقيقية (Groq Edition) ---');
  const livePrices = await getLivePrices();
  if (!livePrices) {
    LOG_E('نظام', 'تعذر جلب بيانات حقيقية، سيتم الإيقاف لتجنب نشر معلومات مضللة.');
    process.exit(1);
  }
  const cleanContent = await generateAIContent(livePrices);
  if (cleanContent) await publishToBinance(cleanContent);
}

run();
