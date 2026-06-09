const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const CONFIG = {
  SQUARE_API_KEY: process.env.BINANCE_SQUARE_KEY,  // نفس المفتاح
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile'
};

async function publishToBinanceSquare(content) {
  const headers = {
    'X-Square-OpenAPI-Key': CONFIG.SQUARE_API_KEY,
    'Content-Type': 'application/json',
    'clienttype': 'binanceSkill'  // 🔑 هذا هو المفتاح السري
  };
  
  const payload = {
    bodyTextOnly: content  // النشر كنص فقط بدون تنسيق
  };
  
  try {
    const response = await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      payload,
      { headers: headers }
    );
    
    if (response.data?.code === '000000') {
      console.log('✅ تم النشر بنجاح على Binance Square!');
      return true;
    } else {
      console.log('❌ فشل النشر:', response.data?.message || response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ خطأ في الاتصال:', error.response?.data || error.message);
    return false;
  }
}

async function generateAIContent(alphaPair) {
  const prompt = `اكتب تحليل فني قصير (فقرتين) لهذه العملات: ${JSON.stringify(alphaPair)}. 
استخدم علامة $ قبل كل رمز. عربي فصحى فقط. انه بنصيحة استثمارية.`;

  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: CONFIG.MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }, { 
      headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEY}` } 
    });
    
    return res.data.choices[0].message.content.replace(/\*/g, '').trim();
  } catch (e) { 
    return null; 
  }
}

async function getAlphaList() {
  try {
    const res = await axios.get('https://api.binance.us/api/v3/ticker/24hr');
    return res.data
      .filter(d => d.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, 4)
      .map(d => ({ symbol: d.symbol.replace('USDT', ''), change: parseFloat(d.priceChangePercent).toFixed(2) }));
  } catch (e) { 
    return null; 
  }
}

async function run() {
  console.log('🚀 بدء البوت...');
  
  const alpha = await getAlphaList();
  if (!alpha) {
    console.log('❌ فشل جلب البيانات');
    return;
  }
  
  console.log('📊 العملات:', alpha.map(c => `${c.symbol} (${c.change}%)`).join(', '));
  
  const content = await generateAIContent(alpha);
  if (!content) {
    console.log('❌ فشل توليد المحتوى');
    return;
  }
  
  console.log('📝 المحتوى:', content.substring(0, 200) + '...');
  
  await publishToBinanceSquare(content);
}

run();