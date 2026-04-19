const DUCKDUCKGO_API_URL = 'https://api.duckduckgo.com/';
const WIKIPEDIA_SEARCH_URL = 'https://en.wikipedia.org/w/api.php';
const WIKIPEDIA_SUMMARY_BASE_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary';

// Comprehensive local knowledge base for common questions
const LOCAL_KNOWLEDGE_BASE = {
  // Technology & Programming
  'artificial intelligence|ai': 'Artificial Intelligence (AI) ek technology hai jo machines ko human-like intelligence develop karne mein madad deti hai. Isme machine learning, deep learning, aur natural language processing shamil hote hain. AI devices ko data se seekhne aur decisions lene ki capability deti hai. AI applications mein chatbots, image recognition, aur autonomous vehicles shamil hain.',
  'machine learning': 'Machine Learning ek AI technique hai jisme programs data se automatically seekhte hain aur improve hote hain without explicit programming. Algorithms pattern identify karte hain aur predictions banate hain. Supervised learning, unsupervised learning, aur reinforcement learning teeno types hote hain.',
  'deep learning': 'Deep Learning ek advanced type ka machine learning hai jo neural networks use karta hai. Ye complex patterns ko recognize karne mein expert hai. Images, voice, aur text processing mein deep learning bahut use hota hai.',
  'python|java|javascript': 'Ye popular programming languages hain jo software development mein use hoti hain. Python data science aur AI mein famous hai, Java enterprise applications mein, aur JavaScript web development mein use hoti hai. JavaScript browsers aur modern web apps ke liye essential hai.',
  'coding|programming': 'Programming ek skill hai jo computers ko instructions dene ke liye use hoti hai. Coding se aap websites, apps, software banate ho. Python, Java, C++, JavaScript jaise languages hote hain. Start karte hain basics se aur practice se improve hote ho.',
  'web development': 'Web development websites aur web applications banane ka process hai. Frontend (UI jo user dekhta hai - HTML, CSS, JavaScript se banaya jata hai) aur backend (server logic - Node.js, Python se). Database bhi important hote hain data store karne ke liye.',
  'app development': 'App development mobile ya desktop applications banane ka process hai. Mobile apps iOS aur Android ke liye Swift ya Kotlin se banaye jate hain. Web-based apps HTML, CSS, JavaScript se banaye jate hain.',
  'database': 'Database ek organized collection hai data ka. SQL databases (MySQL, PostgreSQL) structured data ke liye aur NoSQL databases (MongoDB) flexible data ke liye use hote hain. Data efficiently store aur retrieve karne mein database important hai.',
  
  // General Knowledge - India
  'india|bharat': 'Bharat (India) duniya ka doosra sabse bada desh hai population mein. Iska capital New Delhi hai aur official languages Hindi aur English hain. India technology, IT, space exploration, aur business mein advanced hai. Taj Mahal, Himalaya, aur ancient temples India ke famous landmarks hain.',
  'delhi|new delhi': 'New Delhi Bharat ka capital hai. Ye political aur administrative center hai. Delhi mein Red Fort, India Gate, Raj Ghat, aur Lal Qila famous hain. Delhi mein millions of people rahte hain aur ye very developed city hai.',
  'mumbai': 'Mumbai (formerly Bombay) India ka largest city hai. Isme Bollywood hai, financial hub hai. Gateway of India, Marine Drive, aur Taj Hotel Mumbai ke iconic places hain. Business aur entertainment ka center hai Mumbai.',
  'bengaluru': 'Bengaluru (formerly Bangalore) India ka tech hub hai. Isme IT companies aur startups bahut hain. Software industry mein Bengaluru bahut important role play karta hai. Modern city hai aur young professionals ka favorite destination hai.',
  'pakistan': 'Pakistan South Asia mein ek mulk hai jo India ke paasdosh hai. Iska capital Islamabad hai aur official language Urdu hai. Karachi Pakistan ka largest city hai. Pakistan mein mountain ranges aur deserts hain.',
  'nepal|bhutan': 'Nepal aur Bhutan Himalaya mountain range ke nearby countries hain. Nepal ka capital Kathmandu hai. Bhutan Himalaya mein ek beautiful mountain kingdom hai. Dono countries mein tourism bahut popular hai.',
  
  // Space & Science
  'space': 'Space aasmaan aur universe ko kehte hain jo astronomical objects se filled hai. NASA, SpaceX, ISRO jaise organizations space exploration karte hain. Satellites, rockets, aur spacecraft use hote hain space mein missions ke liye.',
  'moon': 'Chand (Moon) Dharti ka natural satellite hai. Isme water aur minerals hain. Pehli baar 1969 mein Neil Armstrong moon par gaye the. Moon har 29 days mein Dharti ke around ek chakkar lagata hai.',
  'sun': 'Suraj (Sun) hamare solar system ka star hai. Ye light aur heat provide karta hai jo life ke liye essential hai. Sun se 8 planets revolve karte hain, jisme Earth shamil hai.',
  'planets': 'Solar system mein 8 planets hain - Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune. Har planet ka apna unique characteristics hote hain. Earth ke alawa kisi aur planet par abhi koi settlement nahi hai.',
  'astronomy': 'Astronomy ek science hai jo space aur celestial objects ka study karta hai. Stars, planets, galaxies, aur universe ko samjhne ke liye astronomers use observations aur telescopes karte hain.',
  'science': 'Science empirical evidence par based hai. Physics, Chemistry, Biology, jaise branches hote hain. Scientific method observation, hypothesis, experiment, aur conclusion use karta hai.',
  
  // Entertainment
  'bollywood|hindi films': 'Bollywood Hindi film industry hai jo Mumbai mein based hai. Ye duniya ki sabse badi film industry hai production-wise. Famous actors aur directors yahan films banate hain. Bollywood films worldwide mein popular hain.',
  'movies|films': 'Movies visual storytelling medium hain jisme actors aur directors collaborate karte hain. Movies mein different genres hote hain - action, romance, comedy, drama, horror. Cinema halls mein aur online platforms par movies available hote hain.',
  'music': 'Music ek art form hai jisme sounds aur rhythms use hote hain. Different genres - classical, pop, rock, jazz, hip-hop - hote hain. Music production, instruments, aur singing teeno important parts hote hain.',
  
  // Sports
  'cricket': 'Cricket ek popular sport hai especially South Asia mein. India cricket ka powerhouse hai. Matches test, ODI (One Day International), aur T20 formats mein khele jate hain. Cricket equipment mein bat, ball, aur protective gear hote hain.',
  'ipl|indian premier league': 'Indian Premier League (IPL) ek professional cricket league hai India mein jo har saal khela jata hai. Teams ek doosre se T20 format mein match khelte hain. IPL mein international players bhi participate karte hain.',
  'football|soccer': 'Football (Soccer) duniya ka most popular sport hai. Two teams 11 players ke saath match khelte hain. Goal karne se points milte hain. World Cup aur Premier League famous tournaments hain.',
  'basketball': 'Basketball ek sport hai jisme two teams 5 players ke saath court par khelte hain. Ball ko basket mein dalna hota hai. NBA American basketball league hai jo worldwide famous hai.',
  
  // General Concepts
  'love|pyaar': 'Pyaar ek strong emotion hai jo affection, care, aur deep connection se bhara hota hai. Ye family, friends, ya romantic relationships mein ho sakta hai. Love unconditional aur selfless hota hai. Pyaar life ko beautiful aur meaningful banata hai.',
  'friendship|dosti': 'Dosti ek relationship hai jo trust, loyalty, aur mutual understanding par based hoti hai. Acche dost life mein very important hote hain aur challenges mein support dete hain. True friendship rare aur precious hoti hai.',
  'success|safalta': 'Safalta kisi goal ya objective ko achieve karne ko kehte hain. Ye hard work, dedication, persistence, aur smart strategy se milti hai. Har aadmi ka success ka definition alag hota hai. Success journey par focus karna chahiye destination par nahi.',
  'motivation': 'Motivation ek driving force hai jo tumhe goals achieve karne ke liye inspire aur encourage karta hai. Ye internal (self-motivation) ya external (others support) sources se aa sakta hai. Motivation maintain karne ke liye positive mindset important hai.',
  'education|shiksha': 'Shiksha knowledge aur skills develop karne ka process hai. Schools, colleges, online platforms se formal education milta hai. Self-learning bhi important hai. Good education career aur personal growth ke liye foundation provide karta hai.',
  'health|swasthya': 'Swasthya (Health) physical, mental, aur emotional well-being ko kehte hain. Healthy lifestyle exercise, balanced diet, proper sleep, aur stress management se maintain hoti hai. Health har cheez se zyada important hai.',
  'happiness': 'Khusi (Happiness) ek state of mind hai jo satisfaction aur contentment se aata hai. Ye achievements, relationships, nature, aur helping others se aata hai. True happiness internal aur sustainable hoti hai.',
   'life|zindagi': 'Zindagi (Life) ek journey hai jo experiences, learnings, aur relationships se bhri hoti hai. Har phase mein challenges aur opportunities hote hain. Life ko meaningfully aur gratefully jeena chahiye.',

   // More random knowledge
   'time|waqt': 'Waqt (Time) ek important concept hai. 24 hours mein 1 day hota hai, 7 days mein 1 week, 365 days mein 1 saal. Time management life mein success ke liye zaruri hai.',
   'food|khana': 'Khana (Food) body ko energy aur nutrients provide karta hai. Healthy khana fruits, vegetables, grains, aur proteins se banta hai. Indian cuisine rich in flavors aur spices hai.',
   'colors|rango': 'Rango (Colors) visual perception ka part hain. Primary colors red, blue, yellow hain. Colors emotions ko affect karte hain - red passion, blue calm, green nature.',
   'animals|jaanwar': 'Jaanwar (Animals) different species mein hote hain. Pets jaise dogs aur cats, wild jaise lions aur tigers. Animals nature ka important part hain aur biodiversity maintain karte hain.',
   'water|paani': 'Paani (Water) life ka essential element hai. Human body mein 60% water hota hai. Clean water drinking ke liye important hai aur pollution se bachana chahiye.',
   'dreams|sapne': 'Sapne (Dreams) night mein mind ki activities hain. Dreams subconscious thoughts ko reflect karte hain. Some dreams symbolic hote hain aur interpretation different ho sakti hai.',
   'books|kitabein': 'Kitabein (Books) knowledge aur entertainment ka source hain. Fiction, non-fiction, novels, biographies - sab types ke books hain. Reading mind ko develop karta hai.',
   'travel|safar': 'Safar (Travel) new places dekhn aur experience karne ka tarika hai. Travel culture samjhne, relaxation, aur adventure provide karta hai. Planning important hai safe travel ke liye.',
   'internet|net': 'Internet global network hai jo information share karta hai. Websites, emails, social media - sab internet se connected hain. Online safety aur digital literacy important hai.',
   'phone|mobile': 'Mobile phone communication device hai. Calls, messages, apps - sab facilities provide karta hai. Smartphones mein camera, GPS, aur internet access hota hai.',

   // Default comprehensive answer
  'default': 'Sorry, mujhe is topic par abhi detailed information nahi hai. Main website ke features, AI, programming, science, space, sports, entertainment, movies, music, aur general knowledge ke bare mein jaanta hoon. India, world history, nature, aur personal development ke topics par pooch sakte ho. Behtar jawab ke liye English mein poochiye ya specific topic bataye. Koi aur sawaal hai?'
};

const trimText = (value = '') => String(value).replace(/\s+/g, ' ').trim();

const stripHtml = (value = '') => trimText(String(value).replace(/<[^>]+>/g, ' '));

const compactSummary = (value = '', maxSentences = 2, maxChars = 420) => {
  const normalized = trimText(value);
  if (!normalized) {
    return '';
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => trimText(sentence))
    .filter(Boolean);

  const shortVersion = sentences.slice(0, maxSentences).join(' ');
  if (shortVersion && shortVersion.length <= maxChars) {
    return shortVersion;
  }

  return `${normalized.slice(0, maxChars).trim()}...`;
};

const SEARCH_STOP_WORDS = new Set([
  'a',
  'about',
  'abhi',
  'aj',
  'aaj',
  'aur',
  'batao',
  'bare',
  'bataiye',
  'brief',
  'do',
  'ek',
  'explain',
  'for',
  'give',
  'hai',
  'hain',
  'ho',
  'how',
  'intro',
  'is',
  'ka',
  'karo',
  'ke',
  'ki',
  'kya',
  'latest',
  'me',
  'mujhe',
  'on',
  'please',
  'plz',
  'samjhao',
  'short',
  'tell',
  'the',
  'to',
  'what',
  'who',
]);

const simplifySearchQuery = (query = '') => {
  const normalizedQuery = trimText(query)
    .replace(/[?!.,:;()[\]{}"']/g, ' ')
    .replace(/\b(tell me about|who is|what is|kaun hai|kaun tha|kis bare me|ke bare me|ki bare me)\b/gi, ' ');

  const filteredTokens = normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !SEARCH_STOP_WORDS.has(token.toLowerCase()));

  return trimText(filteredTokens.join(' ')) || trimText(query);
};

const buildDuckDuckGoUrl = (query) => {
  const params = new URLSearchParams({
    q: trimText(query),
    format: 'json',
    no_html: '1',
    skip_disambig: '1',
  });

  return `${DUCKDUCKGO_API_URL}?${params.toString()}`;
};

const buildWikipediaSearchUrl = (query) => {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: trimText(query),
    utf8: '1',
    format: 'json',
    origin: '*',
    srlimit: '1',
  });

  return `${WIKIPEDIA_SEARCH_URL}?${params.toString()}`;
};

const fetchDuckDuckGoKnowledge = async (query = '') => {
  const normalizedQuery = simplifySearchQuery(query);

  if (!normalizedQuery) {
    return null;
  }

  const response = await fetch(buildDuckDuckGoUrl(normalizedQuery), {
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await response.json().catch(() => ({}));
  const summary = trimText(data.AbstractText || '');
  const sourceUrl = trimText(data.AbstractURL || '');
  const title = trimText(data.Heading || '');

  if (!response.ok || !summary || !sourceUrl) {
    return null;
  }

  return {
    title: title || normalizedQuery,
    summary: compactSummary(summary),
    sourceUrl,
  };
};

const fetchWikipediaKnowledge = async (query = '') => {
  const normalizedQuery = simplifySearchQuery(query);

  if (!normalizedQuery) {
    return null;
  }

  const searchResponse = await fetch(buildWikipediaSearchUrl(normalizedQuery), {
    headers: {
      'User-Agent': 'NovaCanvas-AIHelpper/1.0',
      Accept: 'application/json',
    },
  });

  const searchData = await searchResponse.json().catch(() => ({}));
  const firstPage = searchData?.query?.search?.[0];

  if (!searchResponse.ok || !firstPage?.title) {
    return null;
  }

  const summaryResponse = await fetch(
    `${WIKIPEDIA_SUMMARY_BASE_URL}/${encodeURIComponent(firstPage.title)}`,
    {
      headers: {
        'User-Agent': 'NovaCanvas-AIHelpper/1.0',
        Accept: 'application/json',
      },
    }
  );

  const summaryData = await summaryResponse.json().catch(() => ({}));

  if (!summaryResponse.ok) {
    return null;
  }

  const extract = trimText(summaryData.extract || stripHtml(firstPage.snippet || ''));
  const sourceUrl = summaryData?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(firstPage.title.replace(/\s+/g, '_'))}`;

  if (!extract) {
    return null;
  }

  return {
    title: firstPage.title,
    summary: compactSummary(extract),
    sourceUrl,
  };
};

const searchLocalKnowledgeBase = (query = '') => {
  if (!query || query.length < 2) {
    return null;
  }

  const normalizedQuery = trimText(query).toLowerCase();
  
  // Search through local knowledge base
  for (const [keywords, answer] of Object.entries(LOCAL_KNOWLEDGE_BASE)) {
    if (keywords === 'default') continue; // Skip default
    
    const keywordList = keywords.split('|');
    const matched = keywordList.some(keyword => 
      normalizedQuery.includes(keyword.toLowerCase()) || 
      keyword.toLowerCase().includes(normalizedQuery)
    );
    
    if (matched) {
      return answer;
    }
  }

  return null;
};

const buildGeneralKnowledgeFallback = async (query = '') => {
  // First try local knowledge base
  const localAnswer = searchLocalKnowledgeBase(query);
  if (localAnswer) {
    return localAnswer;
  }

  // Then try external APIs with error handling
  try {
    const duckDuckGoKnowledge = await fetchDuckDuckGoKnowledge(query);
    if (duckDuckGoKnowledge) {
      return `Live AI search abhi unavailable hai, lekin public web source se ye short jawab mila: ${duckDuckGoKnowledge.summary} Source: ${duckDuckGoKnowledge.sourceUrl}`;
    }
  } catch (error) {
    console.error('DuckDuckGo fetch failed:', error.message);
  }

  try {
    const wikipediaKnowledge = await fetchWikipediaKnowledge(query);
    if (wikipediaKnowledge) {
      return `Live AI search abhi unavailable hai, lekin public knowledge source se ye short jawab mila: ${wikipediaKnowledge.summary} Source: ${wikipediaKnowledge.sourceUrl}`;
    }
  } catch (error) {
    console.error('Wikipedia fetch failed:', error.message);
  }

  // Return comprehensive fallback that acknowledges the AI can help with many topics
  return LOCAL_KNOWLEDGE_BASE['default'] || 'Haan, main aapka sawaal samajh gaya! Mujhe sabhi topics par knowledge hai. Aap technology, science, history, sports, entertainment, ya kisi bhi general knowledge topic ke bare mein pooch sakte ho. Acche se samjhata hoon!';
};

module.exports = {
  buildGeneralKnowledgeFallback,
  fetchDuckDuckGoKnowledge,
  fetchWikipediaKnowledge,
  searchLocalKnowledgeBase,
};
