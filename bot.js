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
  const prompt = `أنت متداول كريبتو خبير. اكتب نصاً قصيراً (بحدود 200 حرف) حول: ${JSON.stringify(alphaPair)}. القواعد: عربي فصحى فقط، بدون لغات أجنبية، أسلوب شخصي، استخدم Cashtags فقط، لا نجوم، لا روابط.`;
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
    const payload = {
      title: "نظرة على السوق 🚀",
      content: content,
      body: content, 
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
          'Referer': 'https://www.binance.com/'
        } 
      }
    );

    if (res.data.success) return true;
    console.log('خطأ من بينانس:', JSON.stringify(res.data));
    return false;
  } catch (e) {
    console.log('خطأ في الاتصال:', e.response?.data?.message || e.message);
    return false;
  }
}

async function run() {
  const alpha = await getAlphaList();
  if (!alpha) return;
  for (let i = 0; i < alpha.length; i += 2) {
    const content = await generateAIContent(alpha.slice(i, i + 2));
    if (content) {
      LOG('نشر', `جاري المحاولة...`);
      const success = await publishToBinance(content);
      if (success) LOG('نشر', '✅ نجاح.');
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

run();
