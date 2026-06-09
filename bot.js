const axios = require('axios');
const dotenv = require('dotenv');

try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile'
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);

async function getAlphaList() {
  try {
    const res = await axios.get('https://api.binance.us/api/v3/ticker/24hr');
    return res.data
      .filter(d => d.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, 4)
      .map(d => ({ symbol: d.symbol.replace('USDT', ''), change: parseFloat(d.priceChangePercent).toFixed(2) }));
  } catch (e) { return null; }
}

async function generateAIContent(alphaPair) {
  const prompt = `أنت متداول كريبتو خبير. اكتب نصاً قصيراً جداً (فقرتين فقط) حول: ${JSON.stringify(alphaPair)}. القواعد: عربي فصحى فقط، بدون أي لغات أجنبية، أسلوب شخصي، استخدم Cashtags فقط، لا نجوم، لا روابط.`;
  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: CONFIG.MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    }, { headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEY}`, 'Content-Type': 'application/json' } });
    return res.data.choices[0].message.content.replace(/\*/g, '').trim();
  } catch (e) { return null; }
}

async function publishToBinance(content) {
  try {
    // تنسيق HTML بسيط جداً كما تتطلبه بينانس
    const cleanContent = `<p>${content.replace(/\n/g, '</p><p>')}</p>`;
    
    // Payload "نظيف" بدون حقول إضافية (تجنب الرفض بسبب الحقول غير المدعومة)
    const payload = {
      title: `نظرة على السوق ${new Date().toLocaleTimeString('ar-EG')}`,
      content: cleanContent,
      type: "ARTICLE",
      language: "AR"
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

    if (res.data && res.data.success) return true;
    
    console.error('فشل النشر - رد الخادم:', JSON.stringify(res.data));
    return false;
  } catch (e) {
    console.error('خطأ في الاتصال:', e.response?.data?.message || e.message);
    return false;
  }
}

async function run() {
  const alpha = await getAlphaList();
  if (!alpha) return;
  
  // نشر مقال واحد فقط يحتوي على العملات لتجنب تقييد الـ Rate Limit
  const content = await generateAIContent(alpha);
  if (content) {
    LOG('نشر', 'جاري إرسال المقال...');
    const success = await publishToBinance(content);
    if (success) LOG('نشر', '✅ تم النشر بنجاح.');
  }
}

run();
