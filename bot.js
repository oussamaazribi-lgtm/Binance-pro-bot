const axios = require('axios');
const dotenv = require('dotenv');

try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_SQUARE_KEY: process.env.BINANCE_SQUARE_KEY, // مفتاح النشر على Binance Square
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile'
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);

// جلب أفضل 4 عملات من Binance
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
    LOG('خطأ', 'فشل جلب البيانات من Binance');
    return null; 
  }
}

// توليد المحتوى باستخدام Groq
async function generateAIContent(alphaPair) {
  const prompt = `اكتب تحليل فني قصير جداً (فقرتين فقط) لهذه العملات: ${JSON.stringify(alphaPair)}. 
  
المتطلبات:
- اللغة: عربية فصحى
- الأسلوب: مهني وتحفيزي
- أضف علامة الدولار قبل كل رمز عملة (مثال: $BTC, $ETH)
- لا تستخدم نجوم * أو علامات ترقيم زائدة
- لا تذكر أسعار محددة، فقط نسب التغير
- انهي بنصيحة استثمارية قصيرة`;

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
    
    let content = res.data.choices[0].message.content;
    content = content.replace(/\*/g, '').trim();
    return content;
  } catch (e) { 
    LOG('خطأ', 'فشل توليد المحتوى من Groq');
    return null; 
  }
}

// النشر على Binance Square
async function publishToBinanceSquare(content) {
  try {
    const title = `📊 تحليل السوق ${new Date().toLocaleDateString('ar-EG')}`;
    
    const payload = {
      title: title,
      content: content,
      contentType: "ORIGINAL",
      language: "ar",
      tags: ["تحليل فني", "عملات رقمية", "تداول"]
    };

    LOG('نشر', 'جاري إرسال المقال إلى Binance Square...');
    
    const res = await axios.post(
      'https://www.binance.com/bapi/square/v1/private/article/add',
      payload,
      { 
        headers: { 
          'X-Square-OpenAPI-Key': CONFIG.BINANCE_SQUARE_KEY,
          'Content-Type': 'application/json'
        } 
      }
    );

    if (res.data?.code === '000000') {
      LOG('نجاح', '✅ تم النشر بنجاح!');
      LOG('رابط', `المقال: ${res.data?.data?.articleId || 'تم النشر'}`);
      return true;
    } else {
      LOG('فشل', `الرد: ${JSON.stringify(res.data)}`);
      return false;
    }
  } catch (e) {
    LOG('خطأ', e.response?.data?.message || e.message);
    return false;
  }
}

// الوظيفة الرئيسية
async function run() {
  LOG('بدء', 'جاري تحليل السوق...');
  
  // 1. جلب العملات الرابحة
  const alphaList = await getAlphaList();
  if (!alphaList || alphaList.length === 0) {
    LOG('خطأ', 'لا توجد بيانات للعملات');
    return;
  }
  
  LOG('تحليل', `العملات المختارة: ${alphaList.map(c => `${c.symbol} (${c.change}%)`).join(', ')}`);
  
  // 2. توليد المحتوى
  LOG('توليد', 'جاري إنشاء المحتوى باستخدام الذكاء الاصطناعي...');
  const articleContent = await generateAIContent(alphaList);
  
  if (!articleContent) {
    LOG('خطأ', 'فشل توليد المحتوى');
    return;
  }
  
  LOG('محتوى', `النص: ${articleContent.substring(0, 100)}...`);
  
  // 3. النشر
  await publishToBinanceSquare(articleContent);
}

// تشغيل البوت
run().catch(err => {
  LOG('خطأ فادح', err.message);
  process.exit(1);
});