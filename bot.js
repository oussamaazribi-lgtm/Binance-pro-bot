const axios = require('axios');
const dotenv = require('dotenv');

try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GEMINI_KEY: process.env.GEMINI_KEY,
  AI_MODEL: 'gemini-1.5-flash'
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);

async function generateAIContent() {
  // هنا نطلب من الذكاء الاصطناعي جلب الأسعار بنفسه وتحليلها
  const prompt = `اعمل كمحلل أسواق كريبتو محترف. 
  1. اجلب أسعار العملات التالية الآن: BTC, ETH, SOL, BNB مقابل USDT.
  2. اكتب تقرير إخباري لـ Binance Square باللغة العربية.
  3. الهيكل: عنوان جذاب، قائمة الأسعار مع نسبة التغيير، تحليل سريع للسوق، نصيحة تفاعلية.
  4. أضف إخلاء مسؤولية: "هذا المحتوى ليس نصيحة استثمارية".
  5. استخدم الهاشتاقات: #BinanceSquare #CryptoMarket #Bitcoin.
  تأكد أن الأرقام حقيقية ومنطقية للسوق اليوم.`;

  try {
    LOG('AI', 'جاري طلب التحليل والبيانات من Gemini...');
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.AI_MODEL}:generateContent?key=${CONFIG.GEMINI_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { timeout: 30000 }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      LOG('AI', '✅ تم توليد المحتوى بنجاح.');
      return text.trim();
    }
  } catch (e) {
    LOG_E('AI', `فشل الذكاء الاصطناعي: ${e.message}`);
  }
  return null;
}

async function publishToBinance(content) {
  if (!CONFIG.BINANCE_KEY) {
    LOG_E('نشر', 'مفتاح BINANCE_KEY غير موجود في الإعدادات!');
    return;
  }

  try {
    LOG('نشر', 'جاري إرسال المنشور إلى Binance Square OpenAPI...');
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
    
    if (res.data && res.data.success !== false) {
      LOG('نشر', '🎉 تم النشر بنجاح على Binance Square!');
    } else {
      LOG_E('نشر', `رد غير متوقع من بينانس: ${JSON.stringify(res.data)}`);
    }
  } catch (e) {
    LOG_E('نشر', `فشل عملية النشر: ${e.response?.data?.message || e.message}`);
  }
}

async function run() {
  console.log('--- بدء دورة النشر الذكية (تجاوز الحظر) ---');
  const postText = await generateAIContent();
  
  if (postText) {
    await publishToBinance(postText);
  } else {
    LOG_E('نظام', 'فشلت الدورة بسبب عدم توفر محتوى.');
    process.exit(1);
  }
}

run();
