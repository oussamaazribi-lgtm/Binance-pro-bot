/**
 * بوت Binance Square - الإصدار الاحترافي (المطور للمصداقية)
 * وظيفة الملف: جلب الأسعار الحقيقية، تحليلها عبر Gemini AI، والنشر التلقائي.
 * مبرمج ليعمل بدقة مع GitHub Actions و Make.com
 */

const axios = require('axios');
const dotenv = require('dotenv');

// تفعيل قراءة ملفات البيئة (للتجربة المحلية فقط)
try { dotenv.config(); } catch(e) {}

// ==================== الإعدادات العامة ====================
const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY, // مفتاح Binance Square API
  GEMINI_KEY: process.env.GEMINI_KEY,   // مفتاح Google Gemini API
  // النماذج المستخدمة (تبديل تلقائي في حال الفشل)
  AI_MODELS: ['gemini-1.5-flash', 'gemini-1.5-pro'],
  // العملات المطلوب مراقبتها
  SYMBOLS: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// ==================== وظائف جلب البيانات الحقيقية ====================

/**
 * جلب الأسعار اللحظية من Binance API الرسمي
 */
async function getValidatedPrices() {
  try {
    LOG('بيانات', 'جاري جلب أحدث الأسعار من Binance API...');
    const res = await axios.get('https://api.binance.com/api/v3/ticker/24hr', { timeout: 10000 });
    const filtered = res.data.filter(t => CONFIG.SYMBOLS.includes(t.symbol));
    
    if (filtered.length < 2) {
      LOG_E('بيانات', 'بيانات السوق المجلوبة غير مكتملة.');
      return null;
    }

    return filtered.map(d => ({
      symbol: d.symbol.replace('USDT', ''),
      price: parseFloat(d.lastPrice).toLocaleString('en-US', { minimumFractionDigits: 2 }),
      change: parseFloat(d.priceChangePercent).toFixed(2)
    }));
  } catch (e) {
    LOG_E('بيانات', `فشل الاتصال بـ API الأسعار: ${e.message}`);
    return null;
  }
}

// ==================== وظائف الذكاء الاصطناعي (AI) ====================

/**
 * توليد محتوى احترافي وصادق بناءً على الأرقام الحقيقية
 */
async function generatePostContent(priceData) {
  if (!priceData) return null;

  // البرومبت المطور لضمان المصداقية ومنع الهلوسة البرمجية
  const prompt = `أنت محلل أسواق عملات رقمية محترف ومعتمد. 
  مهمتك هي كتابة تقرير إخباري دقيق لجمهور Binance Square بناءً على البيانات الحية التالية:
  البيانات الحقيقية (Binance API): ${JSON.stringify(priceData)}
  
  القواعد الصارمة للمصداقية:
  1. الأمانة الرقمية: انقل السعر ونسبة التغيير لكل عملة كما هي في البيانات تماماً. يمنع اختراع أرقام.
  2. التحليل المنطقي: إذا كانت النسبة موجبة، صف الأداء بالانتعاش، وإذا كانت سالبة، صفه بالتصحيح أو الهبوط.
  3. الهيكل المطلوب للمنشور:
     - عنوان جذاب يحتوي على إيموجي مناسب لحالة السوق.
     - تحليل فني سريع لكل عملة (BTC, ETH, SOL, BNB).
     - نصيحة تفاعلية قصيرة للمتابعين.
     - إخلاء مسؤولية إلزامي: "تنبيه: هذا المحتوى للأخبار والمعلومات فقط ولا يعد نصيحة استثمارية."
  4. اللغة: عربية فصحى عصرية ومختصرة.
  5. الهاشتاقات: #BinanceSquare #CryptoMarket #Bitcoin (3 فقط).`;

  for (const model of CONFIG.AI_MODELS) {
    try {
      LOG('AI', `محاولة التوليد باستخدام نموذج ${model}...`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.GEMINI_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { timeout: 30000 }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text && text.length > 100) {
        LOG('AI', `✅ تم التوليد بنجاح باستخدام ${model}`);
        return text.trim();
      }
    } catch (e) {
      const status = e.response?.status;
      LOG_E('AI', `النموذج ${model} واجه مشكلة (Status: ${status || 'Timeout'})`);
      
      if (status === 429) {
        LOG('AI', 'تنبيه: تم الوصول للحد الأقصى، الانتظار 5 ثوانٍ...');
        await sleep(5000);
      }
    }
  }
  
  LOG_E('AI', 'فشلت جميع محاولات AI في توليد محتوى مناسب.');
  return null;
}

// ==================== وظائف النشر ====================

/**
 * إرسال المحتوى النهائي إلى Binance Square عبر OpenAPI
 */
async function publishToBinance(content) {
  if (!CONFIG.BINANCE_KEY) {
    LOG_E('نشر', 'مفتاح BINANCE_KEY مفقود في إعدادات البيئة.');
    return;
  }

  try {
    LOG('نشر', 'جاري إرسال التقرير إلى Binance Square...');
    const res = await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { bodyTextOnly: content },
      { 
        headers: { 
          'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    if (res.data) {
      LOG('نشر', '🎉 تم النشر بنجاح على Binance Square!');
    }
  } catch (e) {
    const errorMsg = e.response?.data?.message || e.message;
    LOG_E('نشر', `فشل عملية النشر: ${errorMsg}`);
  }
}

// ==================== المحرك الرئيسي (Execution) ====================

async function run() {
  console.log('\n--- دورة نشر جديدة ---');
  LOG('نظام', 'بدء تنفيذ العمليات...');

  // 1. جلب وتحقق من الأسعار
  const prices = await getValidatedPrices();
  if (!prices) {
    LOG_E('نظام', 'إيقاف العملية: تعذر الحصول على بيانات الأسعار.');
    process.exit(1); 
  }

  // 2. توليد المحليل بالذكاء الاصطناعي
  const postText = await generatePostContent(prices);
  if (!postText) {
    LOG_E('نظام', 'إيقاف العملية: فشل توليد المحتوى.');
    process.exit(1);
  }

  // 3. تنفيذ النشر النهائي
  await publishToBinance(postText);
  
  LOG('نظام', '🏁 تمت المهمة بنجاح.');
  console.log('-----------------------\n');
}

// انطلاق البوت
run();
