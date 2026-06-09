const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

// 🔑 استخدم الاسم الموجود في GitHub Secrets بالضبط
const BINANCE_API_KEY = process.env.BINANCE_KEY;  // من الصورة
const GROQ_API_KEY = process.env.GROQ_API_KEY;

console.log('🔑 المفتاح موجود:', BINANCE_API_KEY ? 'نعم ✅' : 'لا ❌');
if (BINANCE_API_KEY) {
  console.log('🔑 أول 10 أحرف:', BINANCE_API_KEY.substring(0, 10) + '...');
}

async function publishToBinanceSquare(content) {
  const headers = {
    'X-Square-OpenAPI-Key': BINANCE_API_KEY,
    'Content-Type': 'application/json',
    'clienttype': 'binanceSkill'
  };
  
  const payload = {
    bodyTextOnly: content
  };
  
  try {
    console.log('\n📡 جاري الإرسال إلى Binance Square...');
    
    const response = await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      payload,
      { headers: headers }
    );
    
    console.log('📡 رد الخادم:', JSON.stringify(response.data));
    
    if (response.data?.code === '000000') {
      console.log('✅ تم النشر بنجاح!');
      return true;
    } else {
      console.log('❌ فشل النشر:', response.data?.message);
      return false;
    }
  } catch (error) {
    console.error('❌ خطأ:', error.response?.data || error.message);
    return false;
  }
}

async function generateAIContent(alphaPair) {
  const prompt = `اكتب تحليل فني قصير (فقرتين) لهذه العملات: ${JSON.stringify(alphaPair)}. 
استخدم علامة $ قبل كل رمز. عربي فصحى فقط. انه بنصيحة استثمارية.`;

  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }, { 
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } 
    });
    
    return res.data.choices[0].message.content.replace(/\*/g, '').trim();
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
      .map(d => ({ 
        symbol: d.symbol.replace('USDT', ''), 
        change: parseFloat(d.priceChangePercent).toFixed(2) 
      }));
  } catch (e) { 
    console.error('Binance error:', e.message);
    return null; 
  }
}

async function run() {
  console.log('🚀 بدء البوت...\n');
  
  const alpha = await getAlphaList();
  if (!alpha) {
    console.log('❌ فشل جلب البيانات');
    return;
  }
  
  console.log('📊 العملات:', alpha.map(c => `${c.symbol} (${c.change}%)`).join(', '));
  
  console.log('\n🤖 جاري توليد المحتوى...');
  const content = await generateAIContent(alpha);
  if (!content) {
    console.log('❌ فشل توليد المحتوى');
    return;
  }
  
  console.log('📝 طول المحتوى:', content.length, 'حرف');
  console.log('📝 بداية المحتوى:', content.substring(0, 100) + '...');
  
  await publishToBinanceSquare(content);
}

run();