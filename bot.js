const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const BINANCE_API_KEY = process.env.BINANCE_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function publishToBinanceSquare(content) {
  const headers = {
    'X-Square-OpenAPI-Key': BINANCE_API_KEY,
    'Content-Type': 'application/json',
    'clienttype': 'binanceSkill'
  };
  
  const payload = { bodyTextOnly: content };
  
  try {
    const response = await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      payload,
      { headers: headers }
    );
    
    if (response.data?.code === '000000') {
      console.log('✅ تم النشر بنجاح!');
      return true;
    } else {
      console.log('❌ فشل:', response.data?.message);
      return false;
    }
  } catch (error) {
    console.error('❌ خطأ:', error.response?.data || error.message);
    return false;
  }
}

async function generateAIContent(alphaPair) {
  // تعديل البرومبت ليكون أقل من العملات
  const prompt = `اكتب تحليل فني قصير جداً (فقط 4 سطور) لهذه العملات: ${JSON.stringify(alphaPair)}. 
استخدم علامة $ قبل كل رمز. عربي فصحى فقط.`;

  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300
    }, { 
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } 
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
      .slice(0, 2)  // 🔥 تغيير من 4 إلى 2 عملات فقط
      .map(d => ({ 
        symbol: d.symbol.replace('USDT', ''), 
        change: parseFloat(d.priceChangePercent).toFixed(2) 
      }));
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
  
  console.log('📝 المحتوى:', content);
  console.log('📏 الطول:', content.length, 'حرف');
  
  await publishToBinanceSquare(content);
}

run();