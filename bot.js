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

/**
 * 1. جلب قائمة الـ Alpha (أعلى 5 عملات صعوداً)
 */
async function getAlphaList() {
  try {
    LOG('سوق', 'جاري رصد قائمة الصدارة (Alpha)...');
    const res = await axios.get('https://binance.us');
    const alphaCandidates = res.data
      .filter(d => d.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, 5); // جلب 5 عملات كحد أقصى

    return alphaCandidates.map(d => ({
      symbol: d.symbol.replace('USDT', ''),
      change: parseFloat(d.priceChangePercent).toFixed(2),
      price: d.lastPrice
    }));
  } catch (e) { return null; }
}

/**
 * 2. توليد المحتوى (أسلوب بشري متنوع + إضافة 5 هاشتاغات)
 */
async function generateAIContent(alphaData) {
  if (!alphaData) return null;
  
  const prompt = `أنت محلل كريبتو بشري محترف تنشر على Binance Square. 
  حلل قائمة الـ Alpha الحالية: ${JSON.stringify(alphaData)}. 
  المطلوب: مقال جذاب، استخدام Cashtags ($BTC) للعملات المذكورة فقط، بدون نجوم (***)، وبأسلوب بشري غير مكرر.`;

  try {
    LOG('AI', 'جاري صياغة المحتوى...');
    const response = await axios.post(
      'https://groq.com',
      {
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9
      },
      { headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEY}`, 'Content-Type': 'application/json' } }
    );
    
    let content = response.data?.choices?.[0]?.message?.content?.replace(/\*/g, '').trim();
    
    if (content) {
      // 🌟 إضافة 5 هاشتاغات قوية في نهاية المنشور لزيادة التفاعل
      const hashtags = "\n\n#Crypto #BinanceSquare #Trading #Bitcoin #Altcoins";
      content += hashtags;
    }
    
    return content || null;
  } catch (e) { return null; }
}

/**
 * 3. النشر إلى منصة Binance Square
 */
async function publishToBinance(content) {
  if (!content) {
    LOG_E('نشر', 'المحتوى فارغ، تم إلغاء الإرسال.');
    return;
  }

  try {
    LOG('نشر', 'إرسال البيانات إلى Binance Square...');
    
    const payload = {
      title: "رادار Alpha: تحليل قائمة الصدارة والزخم اللحظي 🚀",
      content: content,           
      bodyTextOnly: content,      
      type: "ARTICLE",
      language: "ar"
    };

    const res = await axios.post(
      'https://binance.com',
      payload,
      { 
        headers: { 
          'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY,
          'Content-Type': 'application/json'
        } 
      }
    );

    if (res.data && res.data.success) {
      LOG('نشر', `✅ تم النشر بنجاح! ID: ${JSON.stringify(res.data.data)}`);
    } else {
      LOG_E('نشر', `فشل النشر: ${res.data.message}`);
      console.log('رد الخادم:', JSON.stringify(res.data));
    }
  } catch (e) {
    LOG_E('نشر', `خطأ اتصال: ${e.response?.data?.message || e.message}`);
  }
}

async function run() {
  console.log(`\n--- دورة Binance Square: ${new Date().toLocaleString()} ---`);
  const alpha = await getAlphaList();
  if (alpha) {
    const post = await generateAIContent(alpha);
    if (post) {
      await publishToBinance(post);
    }
  }
}

run();
