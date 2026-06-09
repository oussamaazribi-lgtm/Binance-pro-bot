const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const CONFIG = {
  BINANCE_SQUARE_KEY: process.env.BINANCE_SQUARE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile'
};

async function getAlphaList() {
  try {
    const res = await axios.get('https://api.binance.us/api/v3/ticker/24hr');
    return res.data
      .filter(d => d.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, 4)
      .map(d => ({ symbol: d.symbol.replace('USDT', ''), change: parseFloat(d.priceChangePercent).toFixed(2) }));
  } catch (e) {
    console.error('خطأ في جلب البيانات:', e.message);
    return null;
  }
}

async function generateAIContent(alphaPair) {
  const prompt = `اكتب تحليل فني قصير لهذه العملات: ${JSON.stringify(alphaPair)}. استخدم $ قبل الرموز. عربي فقط.`;
  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: CONFIG.MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }, { headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEY}` } });
    return res.data.choices[0].message.content.replace(/\*/g, '').trim();
  } catch (e) {
    console.error('خطأ في توليد المحتوى:', e.message);
    return null;
  }
}

async function publishToBinanceSquare(content) {
  const endpoints = [
    'https://www.binance.com/bapi/square/v1/private/article/add',
    'https://www.binance.com/bapi/composite/v1/square/posts'
  ];
  
  for (const url of endpoints) {
    try {
      console.log(`محاولة النشر عبر: ${url}`);
      const res = await axios.post(url, {
        title: `تحليل السوق ${new Date().toLocaleDateString('ar-EG')}`,
        content: content,
        contentType: "ORIGINAL",
        language: "ar"
      }, { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_SQUARE_KEY } });
      
      if (res.data?.code === '000000' || res.data?.success) {
        console.log('✅ تم النشر بنجاح!');
        return true;
      }
    } catch (e) {
      console.log(`فشل في ${url}:`, e.response?.data?.message || e.message);
    }
  }
  return false;
}

async function run() {
  console.log('🚀 بدء البوت...');
  const alpha = await getAlphaList();
  if (!alpha) return;
  console.log('📊 العملات:', alpha.map(c => `${c.symbol} (${c.change}%)`).join(', '));
  const content = await generateAIContent(alpha);
  if (content) {
    await publishToBinanceSquare(content);
  }
}

run();