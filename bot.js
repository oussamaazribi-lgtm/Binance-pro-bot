const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const BINANCE_API_KEY = process.env.BINANCE_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// 🎲 عناصر عشوائية لتغيير شكل المنشور
const emojis = ['🚀', '📊', '🔥', '💎', '⚡', '🎯', '📈', '💰', '👀', '🔮', '💡', '🎲'];
const hashtags = ['#تحليل_فني', '#تداول', '#كريبتو', '#Binance', '#سوق_الأسهم', '#عملات_رقمية', '#فرص', '#توصيات'];
const openers = ['تحليل سريع', 'رصد الفرص', 'تحديث السوق', 'نظرة فنية', 'قراءة المؤشرات', 'فرصة تداول'];
const closers = ['والله أعلم', 'تداول بوعي', 'قرارك مسؤوليتك', 'لا تغامر أكثر من اللازم', 'سوق متقلب', 'حلل قبل القرار'];

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
      console.log('📝 المنشور:', content);
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
  // 🎲 عناصر عشوائية جديدة كل مرة
  const randomEmoji1 = emojis[Math.floor(Math.random() * emojis.length)];
  const randomEmoji2 = emojis[Math.floor(Math.random() * emojis.length)];
  const randomOpener = openers[Math.floor(Math.random() * openers.length)];
  const randomCloser = closers[Math.floor(Math.random() * closers.length)];
  const randomHashtag1 = hashtags[Math.floor(Math.random() * hashtags.length)];
  const randomHashtag2 = hashtags[Math.floor(Math.random() * hashtags.length)];
  
  // 🎲 أمر العملات عشوائي
  const shuffled = [...alphaPair];
  if (Math.random() > 0.5) shuffled.reverse();
  
  // 🎲 أنماط كتابة مختلفة
  const styleVariations = [
    "أسلوب مباشر مع أرقام فقط",
    "أسلوب تحفيزي مع نصائح",
    "أسلوب مختصر جداً (سطرين كحد أقصى)",
    "أسلوب فيه سؤال وجواب",
    "أسلوب مع مقارنة بين العملتين"
  ];
  const randomStyle = styleVariations[Math.floor(Math.random() * styleVariations.length)];
  
  const prompt = `اكتب منشوراً قصيراً جداً (حد أقصى 3 أسطر) لموقع Binance Square عن هذه العملات: ${JSON.stringify(shuffled)}.

🎨 متطلبات التنسيق:
- ${randomStyle}
- ابدأ بـ ${randomEmoji1} ثم ${randomOpener}
- استخدم علامة $ قبل كل رمز عملة
- لا تكرر نفس التركيب في المنشور السابق
- غير ترتيب المعلومات (مرة نسبة الربح أولاً، مرة اسم العملة أولاً)
- انهي بـ ${randomEmoji2} ثم ${randomCloser}

ممنوع منعاً باتاً:
- استخدام نجوم *
- تكرار كلمات
- أسلوب رسمي جامد

الهدف: منشور عربي طبيعي، مختلف، غير متوقع.`;

  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 250
    }, { 
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } 
    });
    
    let content = res.data.choices[0].message.content;
    content = content.replace(/\*/g, '').trim();
    
    // إضافة هاشتاغين في النهاية
    content += `\n\n${randomHashtag1} ${randomHashtag2}`;
    
    return content;
  } catch (e) { 
    console.log('⚠️ AI فشل، جاري استخدام القالب البديل...');
    return generateRandomPost(alphaPair, randomEmoji1, randomEmoji2, randomOpener, randomCloser, randomHashtag1, randomHashtag2);
  }
}

// 🎲 قالب بديل - منشور عشوائي بدون AI
function generateRandomPost(alphaPair, emoji1, emoji2, opener, closer, hashtag1, hashtag2) {
  const coin1 = alphaPair[0];
  const coin2 = alphaPair[1];
  
  const templates = [
    `${emoji1} ${opener}\n$${coin1.symbol} +${coin1.change}% | $${coin2.symbol} +${coin2.change}%\nحجم تداول مرتفع | زخم إيجابي\n${emoji2} ${closer}\n\n${hashtag1} ${hashtag2}`,
    
    `${emoji1} رصد فني\n$${coin1.symbol} : ${coin1.change}% 🔥\n$${coin2.symbol} : ${coin2.change}% 📈\n${emoji2} ${closer}\n\n${hashtag1} ${hashtag2}`,
    
    `$${coin1.symbol} +${coin1.change}%\n$${coin2.symbol} +${coin2.change}%\n${emoji1} ${opener}\n${closer} ${emoji2}\n\n${hashtag1} ${hashtag2}`,
    
    `${emoji1} ${opener}\n${coin2.change}% لـ $${coin2.symbol}\n${coin1.change}% لـ $${coin1.symbol}\nزخم صاعد\n${emoji2} ${closer}\n\n${hashtag1} ${hashtag2}`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

async function getAlphaList() {
  try {
    const res = await axios.get('https://api.binance.us/api/v3/ticker/24hr');
    return res.data
      .filter(d => d.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, 2)
      .map(d => ({ 
        symbol: d.symbol.replace('USDT', ''), 
        change: parseFloat(d.priceChangePercent).toFixed(2) 
      }));
  } catch (e) { 
    console.error('❌ فشل جلب البيانات:', e.message);
    return null; 
  }
}

async function run() {
  console.log('🚀 بدء البوت...\n');
  
  const alpha = await getAlphaList();
  if (!alpha || alpha.length === 0) {
    console.log('❌ فشل جلب البيانات أو لا توجد عملات');
    return;
  }
  
  console.log('📊 العملات:', alpha.map(c => `${c.symbol} (${c.change}%)`).join(', '));
  console.log('🤖 جاري توليد المحتوى...\n');
  
  const content = await generateAIContent(alpha);
  
  console.log('📏 طول المنشور:', content.length, 'حرف');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  await publishToBinanceSquare(content);
}

// تشغيل البوت
run().catch(console.error);