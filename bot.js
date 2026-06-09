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

// تأخير عشوائي لمحاكاة السلوك البشري
const delay = (ms) => new Promise(res => setTimeout(res, ms + Math.random() * 5000));

async function getAlphaList() {
  try {
    const res = await axios.get('https://api.binance.us/api/v3/ticker/24hr');
    return res.data
      .filter(d => d.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, 6) // اختيار أفضل 6 عملات
      .map(d => ({
        symbol: d.symbol.replace('USDT', ''),
        change: parseFloat(d.priceChangePercent).toFixed(2)
      }));
  } catch (e) { return null; }
}

async function generateAIContent(alphaPair) {
  const prompt = `أنت متداول كريبتو محترف. اكتب منشوراً قصيراً لـ Binance Square حول العملات التالية: ${JSON.stringify(alphaPair)}.
  القواعد:
  1. أسلوب بشري: اكتب كمتداول يشارك رأيه الخاص، تجنب لغة التقارير الروبوتية.
  2. اللغة: عربية فصحى فقط. ممنوع تماماً إدخال أي حروف أو كلمات بلغات أخرى (مثل 'مت' أو إنجليزي).
  3. تنوع: نوع في القالب؛ مرة اسأل المتابعين، مرة حلل حركة السعر، مرة أعطِ توقعاً شخصياً.
  4. القيود: لا تستخدم نجوم (***) أو تنسيقات markdown معقدة. استخدم Cashtags للعملات فقط.
  5. اجعل المنشور قصيراً ومباشراً.`;

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: CONFIG.MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85
    }, { headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEY}`, 'Content-Type': 'application/json' } });
    
    return response.data?.choices?.[0]?.message?.content?.replace(/\*/g, '').trim();
  } catch (e) { return null; }
}

async function publishToBinance(content) {
  try {
    const payload = {
      title: "نظرة على زخم السوق اللحظي 📈",
      content: content,
      type: "POST",
      language: "ar"
    };

    const res = await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      payload,
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY, 'Content-Type': 'application/json' } }
    );

    return res.data.success;
  } catch (e) { return false; }
}

async function run() {
  console.log(`\n--- بدء الدورة: ${new Date().toLocaleString()} ---`);
  const alpha = await getAlphaList();
  if (!alpha) return;

  // تقسيم الـ 6 عملات إلى 3 منشورات (كل منشور عملتين)
  for (let i = 0; i < alpha.length; i += 2) {
    const pair = alpha.slice(i, i + 2);
    const postContent = await generateAIContent(pair);
    
    if (postContent) {
      LOG('نشر', `جاري إرسال الجزء ${i/2 + 1}...`);
      const success = await publishToBinance(postContent);
      if (success) LOG('نشر', '✅ تم النشر بنجاح.');
      else LOG_E('نشر', 'فشل نشر هذا الجزء.');
      
      await delay(10000); // انتظار 10-15 ثانية بين كل منشور
    }
  }
}

run();
