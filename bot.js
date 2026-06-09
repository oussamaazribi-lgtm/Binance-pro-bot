const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const CONFIG = {
  BINANCE_SQUARE_KEY: process.env.BINANCE_SQUARE_KEY, // المفتاح الوحيد
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
      .map(d => ({ 
        symbol: d.symbol.replace('USDT', ''), 
        change: parseFloat(d.priceChangePercent).toFixed(2) 
      }));
  } catch (e) { 
    LOG('خطأ', 'فشل جلب البيانات');
    return null; 
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
      max_tokens: 500
    }, { 
      headers: { 
        'Authorization': `Bearer ${CONFIG.GROQ_KEY}`, 
        'Content-Type': 'application/json' 
      } 
    });
    
    return res.data.choices[0].message.content.replace(/\*/g, '').trim();
  } catch (e) { 
    LOG('خطأ', 'فشل توليد المحتوى');
    return null; 
  }
}

async function publishToBinanceSquare(content) {
  try {
    const payload = {
      title: `📊 تحليل السوق ${new Date().toLocaleDateString('ar-EG')}`,
      content: content,
      contentType: "ORIGINAL",
      language: "ar"
    };

    LOG('نشر', 'جاري إرسال المقال...');
    
    const res = await axios.post(
      'https://www.binance.com/bapi/square/v1/private/article/add',
      payload,
      { 
        headers: { 
          'Authorization': `Bearer ${CONFIG.BINANCE_SQUARE_KEY}`,  // Bearer token
          'Content-Type': 'application/json'
        } 
      }
    );

    if (res.data?.code === '000000' || res.data?.success === true) {
      LOG('نجاح', '✅ تم النشر بنجاح!');
      LOG('رابط', `https://www.binance.com/en/square/post/${res.data?.data?.articleId || ''}`);
      return true;
    } else {
      LOG('فشل', JSON.stringify(res.data));
      return false;
    }
  } catch (e) {
    LOG('خطأ', e.response?.data?.message || e.message);
    return false;
  }
}

async function run() {
  LOG('بدء', 'جاري تحليل السوق...');
  
  const alphaList = await getAlphaList();
  if (!alphaList || alphaList.length === 0) {
    LOG('خطأ', 'لا توجد بيانات');
    return;
  }
  
  LOG('تحليل', `العملات: ${alphaList.map(c => `${c.symbol} (${c.change}%)`).join(', ')}`);
  
  LOG('توليد', 'جاري إنشاء المحتوى...');
  const articleContent = await generateAIContent(alphaList);
  
  if (!articleContent) {
    LOG('خطأ', 'فشل توليد المحتوى');
    return;
  }
  
  LOG('محتوى', articleContent);
  
  await publishToBinanceSquare(articleContent);
}

run();