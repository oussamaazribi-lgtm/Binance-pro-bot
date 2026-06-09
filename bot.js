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
  const prompt = `أنت متداول كريبتو خبير. اكتب نصاً قصيراً (بحدود 200 حرف) حول: ${JSON.stringify(alphaPair)}. 
  القواعد: عربي فصحى فقط، بدون أي لغات أجنبية، أسلوب شخصي، استخدم Cashtags فقط، لا تستخدم نجوم، لا تضع روابط.`;
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
    // تحديث الهيكل: إضافة حقل content و body معاً لضمان التوافق مع تحديثات 2026
    const payload = {
      title: "تحديث السوق اللحظي 🚀",
      content: content,
      body: content, 
      summary: content.substring(0, 50),
      type: "ARTICLE",
      language: "AR"
    };

    const res = await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      payload,
      { 
        headers: { 
          'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY,
          'Content-Type': 'application/json',
          'Origin': 'https://www.binance.com',
          'Referer': 'https://www.binance.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        } 
      }
    );

    return res.data.success ? true : (console.log('خطأ من بينانس:', res.data), false);
  } catch (e) {
    console.log('خطأ في الاتصال:', e.response?.data || e.message);
    return false;
  }
}

async function run() {
  const alpha = await getAlphaList();
  if (!alpha) return;
  for (let i = 0; i < alpha.length; i += 2) {
    const content = await generateAIContent(alpha.slice(i, i + 2));
    if (content) {
      LOG('نشر', `جاري محاولة النشر...`);
      const success = await publishToBinance(content);
      if (success) LOG('نشر', '✅ نجاح.');
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

run();
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

async function getAlphaList() {
  try {
    const res = await axios.get('https://api.binance.us/api/v3/ticker/24hr');
    return res.data
      .filter(d => d.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, 4) // تقليل العدد لضمان القبول
      .map(d => ({ symbol: d.symbol.replace('USDT', ''), change: parseFloat(d.priceChangePercent).toFixed(2) }));
  } catch (e) { return null; }
}

async function generateAIContent(alphaPair) {
  const prompt = `أنت متداول كريبتو خبير. اكتب نصاً قصيراً جداً وجذاباً (أقل من 300 حرف) حول العملات: ${JSON.stringify(alphaPair)}.
  القواعد:
  1. عربي فصحى فقط. ممنوع تماماً أي لغة أجنبية.
  2. تجنب لغة الروبوتات، اكتب بأسلوب شخصي.
  3. استخدم Cashtags للعملات.
  4. لا تستخدم نجوم أو تنسيق markdown معقد.`;

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
    // محاولة النشر بنوع ARTICLE وهو الأكثر استقراراً في الـ API
    const payload = {
      title: "تحديث سريع لحركة السوق 🚀",
      content: content,
      type: "ARTICLE", 
      language: "ar"
    };

    const res = await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      payload,
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY, 'Content-Type': 'application/json' } }
    );

    if (res.data.success) return true;
    else {
      console.log('تفاصيل رفض الخادم:', JSON.stringify(res.data));
      return false;
    }
  } catch (e) {
    console.log('خطأ في الاتصال:', e.response?.data || e.message);
    return false;
  }
}

async function run() {
  const alpha = await getAlphaList();
  if (!alpha) return;

  for (let i = 0; i < alpha.length; i += 2) {
    const pair = alpha.slice(i, i + 2);
    const content = await generateAIContent(pair);
    if (content) {
      LOG('نشر', `جاري إرسال الجزء ${i/2 + 1}...`);
      const success = await publishToBinance(content);
      if (success) LOG('نشر', '✅ تم النشر.');
      else LOG_E('نشر', 'فشل النشر، راجع الخطأ أعلاه.');
      await new Promise(r => setTimeout(r, 15000)); // زيادة التأخير لـ 15 ثانية
    }
  }
}

run();
