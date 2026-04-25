const axios = require('axios');
const dotenv = require('dotenv');

try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY || process.env.GEMINI_KEY, // سيقبل المفتاح تحت أي من الاسمين
  MODEL: 'llama-3.3-70b-versatile'
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);

async function generateAIContent() {
  const prompt = `أنت محلل أسواق كريبتو محترف. 
  المهمة: اكتب تقرير إخباري حياً لـ Binance Square باللغة العربية.
  المطلوب: 
  1. ابحث عن أسعار BTC, ETH, SOL و BNB الآن.
  2. التنسيق: عنوان مثير، قائمة العملات مع أسعارها التقديرية وتغييرها اليومي، تحليل سريع للاتجاه (صعود/هبوط).
  3. أضف إخلاء مسؤولية قانوني في النهاية.
  4. استخدم هاشتاقات: #BinanceSquare #Bitcoin #CryptoNews.`;

  try {
    LOG('Groq', 'جاري طلب التحليل من Groq Cloud...');
    
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.GROQ_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const text = response.data?.choices?.[0]?.message?.content;
    if (text) {
      LOG('Groq', '✅ تم توليد المحتوى بسرعة فائقة!');
      return text.trim();
    }
  } catch (e) {
    LOG_E('Groq', `فشل الاتصال: ${e.response?.data?.error?.message || e.message}`);
  }
  return null;
}

async function publishToBinance(content) {
  try {
    LOG('نشر', 'جاري الإرسال إلى Binance Square...');
    const res = await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { bodyTextOnly: content },
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY } }
    );
    LOG('نشر', '🎉 تم النشر بنجاح!');
  } catch (e) {
    LOG_E('نشر', `فشل النشر: ${e.message}`);
  }
}

async function run() {
  console.log('--- تشغيل البوت باستخدام محرك Groq الصاروخي ---');
  const postText = await generateAIContent();
  if (postText) await publishToBinance(postText);
  else process.exit(1);
}

run();
