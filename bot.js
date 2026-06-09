const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const CONFIG = {
  SQUARE_API_KEY: process.env.BINANCE_SQUARE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile'
};

async function publishToBinanceSquare(content) {
  // 🔑 نفس الطريقة بالضبط من الكود العامل
  const headers = {
    'X-Square-OpenAPI-Key': CONFIG.SQUARE_API_KEY,
    'Content-Type': 'application/json',
    'clienttype': 'binanceSkill'  // هذا مهم جداً!
  };
  
  const payload = {
    bodyTextOnly: content  // لاحظ bodyTextOnly وليس content
  };
  
  try {
    console.log('📡 جاري الإرسال إلى Binance Square...');
    
    const response = await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      payload,
      { headers: headers }
    );
    
    console.log('📡 رد الخادم:', JSON.stringify(response.data));
    
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
    
    let content = res.data.choices[0].message.content;
    content = content.replace(/\*/g, '').trim();
    return content;
  } catch (e) { 
    console.error('Groq error:', e.message);
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
    console.error('Binance error:', e.message);
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
  
  console.log('🤖 جاري توليد المحتوى...');
  const content = await generateAIContent(alpha);
  if (!content) {
    console.log('❌ فشل توليد المحتوى');
    return;
  }
  
  console.log('📝 المحتوى:', content.substring(0, 150) + '...');
  console.log('📏 طول المحتوى:', content.length, 'حرف');
  
  await publishToBinanceSquare(content);
}

run();