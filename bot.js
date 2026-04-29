const axios = require('axios');
const dotenv = require('dotenv');

// تحميل الإعدادات من ملف .env (للتشغيل المحلي)
try { dotenv.config(); } catch(e) {}

const CONFIG = {
  BINANCE_KEY: process.env.BINANCE_KEY,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: 'llama-3.3-70b-versatile',
  // العملات القيادية الثابتة للربط التحليلي
  LEADERS: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
};

const LOG = (step, msg) => console.log(`[${step}] ${msg}`);
const LOG_E = (step, msg) => console.error(`[${step}] ❌ ${msg}`);

/**
 * 1. رادار السوق الذكي: جلب العملات الرائجة + العملات تحت 1 دولار + العملات القيادية
 */
async function getMarketData() {
  const url = 'https://api3.binance.com/api/v3/ticker/24hr';

  try {
    LOG('رادار', 'جاري مسح السوق للبحث عن فرص Alpha والعملات الرائجة...');
    const res = await axios.get(url, { timeout: 15000 });
    const allTickers = res.data;

    // أ. جلب بيانات العملات القيادية
    const leadersData = allTickers.filter(t => CONFIG.LEADERS.includes(t.symbol));

    // ب. جلب العملات البديلة "الرائجة" (أعلى حجم تداول) وسعرها أقل من 1 دولار
    // نستهدف العملات المقترنة بـ USDT وتملك سيولة عالية
    const trendingAlts = allTickers
      .filter(t => 
        t.symbol.endsWith('USDT') && 
        parseFloat(t.lastPrice) < 1.0 && 
        parseFloat(t.lastPrice) > 0 &&
        !CONFIG.LEADERS.includes(t.symbol)
      )
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 6); // خذ أفضل 6 عملات "رخيصة" رائجة

    const finalSelection = [...leadersData, ...trendingAlts];

    return finalSelection.map(d => ({
      symbol: d.symbol.replace('USDT', ''),
      price: parseFloat(d.lastPrice) < 0.001 ? d.lastPrice : parseFloat(d.lastPrice).toLocaleString('en-US'),
      change: parseFloat(d.priceChangePercent).toFixed(2),
      volume: (parseFloat(d.quoteVolume) / 1000000).toFixed(2) + 'M',
      isAlpha: parseFloat(d.lastPrice) < 1.0,
      high: parseFloat(d.highPrice).toLocaleString(),
      low: parseFloat(d.lowPrice).toLocaleString()
    }));
  } catch (e) {
    LOG_E('رادار', `فشل جلب بيانات السوق: ${e.message}`);
    return null;
  }
}

/**
 * 2. جلب أخبار حقيقية مفصلة
 */
async function getDetailedNews() {
  try {
    LOG('أخبار', 'سحب آخر مستجدات السوق من CryptoCompare...');
    const res = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN', { timeout: 10000 });
    
    if (res.data && res.data.Data) {
      return res.data.Data.slice(0, 3).map(n => ({
        title: n.title,
        summary: n.body,
        url: n.url
      }));
    }
  } catch (e) {
    LOG_E('أخبار', 'فشل جلب الأخبار، سنعتمد على تحليل حركة السيولة.');
  }
  return null;
}

/**
 * 3. توليد المحتوى الاحترافي باستخدام Groq (Alpha Hunter Mode)
 */
async function generateAIContent(marketData, news) {
  if (!marketData) return null;

  const prompt = `أنت خبير "Alpha Hunter" ومحلل تقني رائد على Binance Square في أبريل 2026.
  
  بيانات الرادار اللحظية: ${JSON.stringify(marketData)}
  أخبار السوق العاجلة: ${news ? JSON.stringify(news) : "لا توجد أخبار، ركز على انفجار السيولة وحركة السعر."}
  
  المطلوب:
  1. ركز على العملات البديلة (Altcoins) التي تظهر في البيانات وسعرها أقل من 1 دولار كفرص "Alpha" مبكرة.
  2. حلل العلاقة بين حركة $BTC وشهية المخاطرة في العملات الرائجة المذكورة.
  3. التنسيق: استخدم Cashtags (مثل $SOL)، فقرات جذابة، وإيموجي احترافي (🔥, 📊, 🚀).
  4. أسلوب الكتابة: حماسي، تقني، ومباشر. سلط الضوء على العملة التي تملك أعلى "Volume" أو أكبر "Change".
  5. ممنوع تماماً استخدام النجوم (***) أو إخلاء المسؤولية.
  6. الخاتمة: رادار التوقع لاتجاه السوق في الساعات القادمة.
  
  اللغة: عربية فصحى عصرية قوية.`;

  try {
    LOG('AI', 'جاري صياغة التقرير الفني عبر Groq...');
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6
      },
      { headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEY}`, 'Content-Type': 'application/json' } }
    );

    let text = response.data?.choices?.[0]?.message?.content;
    return text.replace(/\*/g, '').trim();
  } catch (e) {
    LOG_E('AI', `فشل توليد المحتوى: ${e.message}`);
  }
  return null;
}

/**
 * 4. النشر التلقائي على Binance Square
 */
async function publishToBinance(content) {
  try {
    LOG('نشر', 'إرسال المقال إلى Binance Square OpenAPI...');
    await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { bodyTextOnly: content },
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY } }
    );
    LOG('نشر', '✅ تم النشر بنجاح! رادار Alpha يعمل بكفاءة.');
  } catch (e) {
    LOG_E('نشر', `فشل النشر: ${e.message}`);
  }
}

/**
 * الدورة التشغيلية
 */
async function run() {
  console.log(`\n--- تحديث الرادار: ${new Date().toLocaleString()} ---`);
  
  const market = await getMarketData();
  const news = await getDetailedNews();
  
  if (market && market.length > 0) {
    const post = await generateAIContent(market, news);
    if (post) {
      await publishToBinance(post);
    }
  } else {
    LOG_E('نظام', 'فشل الرادار في العثور على بيانات كافية، تم إلغاء الدورة.');
  }
}

run();
