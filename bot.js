const axios = require('axios');
const dotenv = require('dotenv');

try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GEMINI_KEY: process.env.GEMINI_KEY,
  AI_MODELS: ['gemini-1.5-flash', 'gemini-1.5-pro'],
  SYMBOLS: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function getValidatedPrices() {
  try {
    LOG('بيانات', 'جاري جلب أحدث الأسعار من الرابط البديل...');
    // تم تغيير الرابط إلى api1 أو api3 لتجاوز حظر خوادم GitHub
    const res = await axios.get('https://api1.binance.com/api/v3/ticker/24hr', { timeout: 15000 });
    
    const filtered = res.data.filter(t => CONFIG.SYMBOLS.includes(t.symbol));
    if (filtered.length < 2) return null;

    return filtered.map(d => ({
      symbol: d.symbol.replace('USDT', ''),
      price: parseFloat(d.lastPrice).toLocaleString('en-US', { minimumFractionDigits: 2 }),
      change: parseFloat(d.priceChangePercent).toFixed(2)
    }));
  } catch (e) {
    LOG_E('بيانات', `فشل الاتصال: ${e.response?.status || e.message}`);
    return null;
  }
}

async function generatePostContent(priceData) {
  if (!priceData) return null;

  const prompt = `أنت محلل أسواق عملات رقمية محترف ومعتمد. 
  مهمتك هي كتابة تقرير إخباري دقيق لجمهور Binance Square بناءً على البيانات الحية التالية:
  البيانات الحقيقية (Binance API): ${JSON.stringify(priceData)}
  
  القواعد الصارمة للمصداقية:
  1. الأمانة الرقمية: انقل السعر ونسبة التغيير كما هي في البيانات تماماً.
  2. التحليل المنطقي: إذا كانت النسبة موجبة، صف الأداء بالانتعاش، وإذا كانت سالبة، صفه بالتصحيح.
  3. الهيكل المطلوب: عنوان بإيموجي، تحليل سريع للعملات، نصيحة تفاعلية، وإخلاء مسؤولية قانوني.
  4. الهاشتاقات: #BinanceSquare #CryptoMarket #Bitcoin`;

  for (const model of CONFIG.AI_MODELS) {
    try {
      LOG('AI', `محاولة التوليد باستخدام ${model}...`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.GEMINI_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { timeout: 30000 }
      );
      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.length > 100) return text.trim();
    } catch (e) {
      LOG_E('AI', `فشل النموذج ${model}`);
    }
  }
  return null;
}

async function publishToBinance(content) {
  if (!CONFIG.BINANCE_KEY) return;
  try {
    LOG('نشر', 'جاري إرسال التقرير إلى Binance Square...');
    await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { bodyTextOnly: content },
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    LOG('نشر', '🎉 تم النشر بنجاح على Binance Square!');
  } catch (e) {
    LOG_E('نشر', `فشل عملية النشر: ${e.response?.data?.message || e.message}`);
  }
}

async function run() {
  console.log('--- دورة نشر جديدة ---');
  const prices = await getValidatedPrices();
  if (!prices) process.exit(1);
  const postText = await generatePostContent(prices);
  if (!postText) process.exit(1);
  await publishToBinance(postText);
}

run();
