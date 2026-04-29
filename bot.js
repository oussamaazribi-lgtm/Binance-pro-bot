const axios = require('axios');
const dotenv = require('dotenv');

try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile'
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);

/**
 * 1. جلب قائمة الـ Alpha (أعلى العملات صعوداً)
 */
async function getAlphaList() {
  try {
    LOG('سوق', 'جاري جلب قائمة الصدارة (Alpha)...');
    const res = await axios.get('https://api.binance.us/api/v3/ticker/24hr');
    const alphaCandidates = res.data
      .filter(d => d.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, 7);

    return alphaCandidates.map(d => ({
      symbol: d.symbol.replace('USDT', ''),
      change: parseFloat(d.priceChangePercent).toFixed(2),
      price: d.lastPrice
    }));
  } catch (e) { return null; }
}

/**
 * 2. توليد المحتوى بأسلوب بشري غير متكرر
 */
async function generateAIContent(alphaData) {
  if (!alphaData) return null;
  
  const prompt = `أنت محلل كريبتو بشري محترف على Binance Square. 
  بيانات الـ Alpha اللحظية: ${JSON.stringify(alphaData)}. 
  
  المطلوب:
  1. اكتب مقالاً تحليلياً سريعاً وجذاباً عن هذه العملات المتصدرة.
  2. استخدم Cashtags (مثل $SOL) وإيموجي.
  3. الأسلوب: بشري، متنوع، لا يبدأ بنفس الجملة دائماً.
  4. ممنوع تماماً استخدام النجوم (***).
  5. اللغة: عربية فصحى طبيعية.`;

  try {
    LOG('AI', 'جاري صياغة المحتوى...');
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9
      },
      { headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEY}`, 'Content-Type': 'application/json' } }
    );
    return response.data?.choices?.[0]?.message?.content?.replace(/\*/g, '').trim();
  } catch (e) { return null; }
}

/**
 * 3. النشر (الصيغة الأصلية والمباشرة)
 */
async function publishToBinance(content) {
  try {
    LOG('نشر', 'إرسال البيانات إلى Binance Square...');
    
    // ملاحظة: قمنا بإعادة الحقل إلى content فقط وهو الحقل الأكثر استقراراً
    const payload = {
      title: "تحليل رادار Alpha اليومي 🚀",
      content: content
    };

    const res = await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      payload,
      { 
        headers: { 
          'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY,
          'Content-Type': 'application/json'
        } 
      }
    );

    // إذا كان الرد يحتوي على معرف (ID) للمنشور، فهذا يعني نجاحاً حقيقياً
    if (res.data) {
      LOG('نشر', `✅ تم النشر! استجابة النظام: ${JSON.stringify(res.data)}`);
    }
  } catch (e) {
    LOG_E('نشر', `خطأ في الإرسال: ${e.response?.data?.message || e.message}`);
  }
}

async function run() {
  console.log(`\n--- دورة Binance Square: ${new Date().toLocaleString()} ---`);
  const alpha = await getAlphaList();
  if (alpha) {
    const post = await generateAIContent(alpha);
    if (post) {
      await publishToBinance(post);
    }
  }
}

run();
