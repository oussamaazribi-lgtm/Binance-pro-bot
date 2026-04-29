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
 * 1. رادار الـ Alpha: جلب العملات الأكثر صعوداً وزخماً (Top Gainers)
 */
async function getAlphaList() {
  try {
    LOG('رادار', 'جاري مسح السوق لاصطياد عملات الـ Alpha...');
    const res = await axios.get('https://api.binance.us/api/v3/ticker/24hr');
    
    // فلترة العملات التي تحقق أعلى صعود (Top Gainers) لمحاكاة قائمة Alpha
    const alphaCandidates = res.data
      .filter(d => d.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, 8); // نأخذ أفضل 8 عملات متفجرة

    return alphaCandidates.map(d => ({
      symbol: d.symbol.replace('USDT', ''),
      change: parseFloat(d.priceChangePercent).toFixed(2),
      price: d.lastPrice,
      volume: (parseFloat(d.quoteVolume) / 1000000).toFixed(2) + 'M'
    }));
  } catch (e) {
    LOG_E('رادار', 'فشل مسح السوق.');
    return null;
  }
}

/**
 * 2. جلب الأخبار (جوجل RSS - مستقر جداً)
 */
async function getMarketNews() {
  try {
    const url = `https://news.google.com/rss/search?q=crypto+market+trending+when:12h&hl=en-US&gl=US&ceid=US:en`;
    const res = await axios.get(url, { timeout: 10000 });
    const titles = res.data.match(/<title>(.*?)<\/title>/g) || [];
    return titles.slice(1, 4).map(t => t.replace(/<\/?title>/g, ''));
  } catch (e) { return null; }
}

/**
 * 3. صياغة المحتوى (بشري، متغير، ومنطقي لقائمة Alpha)
 */
async function generateAIContent(alphaData, news) {
  if (!alphaData) return null;

  const personalities = [
    "قناص فرص رقمي يراقب شاشات التداول لحظة بلحظة.",
    "محلل حيتان يركز على السيولة التي تضخ في عملات الـ Alpha.",
    "متداول محترف يشارك 'السبق' مع متابعيه بأسلوب سريع."
  ];
  const selectedStyle = personalities[Math.floor(Math.random() * personalities.length)];

  const prompt = `أنت محلل بشري محترف على Binance Square. مهمتك تحليل قائمة الـ "Alpha" الحالية.
  البيانات المتفجرة الآن: ${JSON.stringify(alphaData)}
  أخبار السوق: ${news ? JSON.stringify(news) : "تركيز كامل على حركة السعر والسيولة."}
  
  المطلوب:
  1. الشخصية: [${selectedStyle}]. لا تكرر نفسك أبداً. ابدأ بأسلوب مختلف (مثلاً: ملاحظة عن عملة محددة، أو حالة السوق العامة).
  2. منطق الـ Alpha: حلل لماذا هذه العملات تتصدر المشهد؟ (زخم، سيولة مفاجئة، صعود صاروخي).
  3. التنسيق: استخدم Cashtags (مثل $RLS)، إيموجي الرادار 🔥 والبرق ⚡، فقرات قصيرة جداً سريعة القراءة.
  4. اللغة: عربية فصحى بيضاء طبيعية. ممنوع النجوم (***).
  5. اجعل القارئ يشعر أنك "تكتب الآن" بناءً على ما تراه في الشاشة.`;

  try {
    LOG('AI', `صياغة التقرير بأسلوب: ${selectedStyle}`);
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9
      },
      { headers: { 'Authorization': `Bearer ${CONFIG.GROQ_KEY}`, 'Content-Type': 'application/json' } }
    );
    return response.data?.choices?.[0]?.message?.content?.replace(/\*/g, '').trim();
  } catch (e) { return null; }
}

/**
 * 4. النشر
 */
async function publish(content) {
  try {
    LOG('نشر', 'إرسال إلى Binance Square...');
    await axios.post(
      'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add',
      { title: "رادار Alpha: انفجار السيولة والعملات المتصدرة 🚀", content: content, type: "ARTICLE", language: "ar" },
      { headers: { 'X-Square-OpenAPI-Key': CONFIG.BINANCE_KEY, 'Content-Type': 'application/json' } }
    );
    LOG('نشر', '✅ تم النشر بنجاح!');
  } catch (e) { LOG_E('نشر', 'فشل النشر.'); }
}

async function run() {
  console.log(`\n--- دورة Alpha الذكية: ${new Date().toLocaleString()} ---`);
  const alpha = await getAlphaList();
  const news = await getMarketNews();
  if (alpha) {
    const post = await generateAIContent(alpha, news);
    if (post) await publish(post);
  }
}

run();
