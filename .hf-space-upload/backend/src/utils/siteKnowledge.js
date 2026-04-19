const WEBSITE_KNOWLEDGE_SECTIONS = [
  {
    id: 'overview',
    title: 'Platform Overview',
    keywords: ['website', 'site', 'platform', 'about', 'overview', 'nova', 'canvas', 'home'],
    answer:
      'Yeh website Nova Canvas hai, ek AI media studio jahan users images generate kar sakte hain, public gallery publish kar sakte hain, aur creator profile manage kar sakte hain. Video tools ka UI bhi hai, lekin actual runtime availability backend configuration par depend karti hai.',
    details: [
      'Landing page par platform ka overview, feature highlights, aur signup/login links milte hain.',
      'App me public Explore page bhi hai jahan creators ke public images dikhte hain.',
      'Logged-in users ke liye Dashboard me studio tools, history, community composer, aur profile controls available hain.',
    ],
  },
  {
    id: 'auth',
    title: 'Authentication',
    keywords: ['login', 'log in', 'signup', 'sign up', 'register', 'account', 'password', 'forgot', 'reset'],
    answer:
      'Account banane ke liye signup page use hota hai. Login ke baad dashboard access milta hai, aur forgot password flow se reset code ke through password change kiya ja sakta hai.',
    details: [
      'Signup email ya phone ke through ho sakta hai, depending on configured contact method.',
      'Login page me remember me support hai.',
      'Forgot password page verification code ke saath password reset allow karta hai.',
      'Protected dashboard bina login ke open nahi hota.',
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    keywords: ['dashboard', 'studio', 'tab', 'creator studio', 'workspace'],
    answer:
      'Dashboard creator studio hai jahan se media generate hota hai, history dekhi ja sakti hai, community section use hota hai, aur profile manage ki ja sakti hai.',
    details: [
      'Sidebar se generate, history, community, aur profile sections switch hote hain.',
      'Header me current creator account ka quick profile button hota hai.',
      'Studio online presence indicator bhi dikhaya jata hai.',
    ],
  },
  {
    id: 'image-generation',
    title: 'Image Generation',
    keywords: ['image', 'photo', 'generate image', 'text to image', 'ratio', 'quality', 'prompt'],
    answer:
      'Image generation ke liye dashboard ke Generate tab me prompt likh kar text-to-image mode use kiya jata hai. Aspect ratio aur quality bhi choose ki ja sakti hai.',
    details: [
      'Supported aspect ratios me 1:1, 16:9, 9:16, 4:3, aur 3:4 options hain.',
      'Quality options fast, balanced, aur high hain.',
      'Result aane ke baad download, copy link, regenerate, aur Explore me publish options milte hain.',
      'Image history automatically user ke account me save hoti hai.',
    ],
  },
  {
    id: 'video-generation',
    title: 'Video Generation',
    keywords: ['video', 'text to video', 'image to video', 'animate', 'motion', 'wan', 'hugging face', 'piapi'],
    answer:
      'Website me text-to-video aur image-to-video ke UI options maujood hain, lekin actual success backend video provider, credits, aur configuration par depend karti hai. Isliye video tool visible hona aur real me kaam karna alag cheezein hain.',
    details: [
      'Text-to-video mode me prompt se short video request ki ja sakti hai.',
      'Image-to-video mode me pehle image upload hoti hai, phir optional animation prompt diya ja sakta hai.',
      'Backend Hugging Face aur optional PiAPI fallback use kar sakta hai, lekin agar credits ya provider issue ho to request fail ho sakti hai.',
      'Video outputs abhi download aur link sharing ke liye best hain; Explore aur history image-first experience hai.',
    ],
  },
  {
    id: 'history',
    title: 'History',
    keywords: ['history', 'archive', 'previous', 'generated', 'old image', 'past result'],
    answer:
      'History section me user ke pehle generate kiye gaye images dekhne, revisit karne, aur manage karne ka option milta hai.',
    details: [
      'Generated results latest-first order me dikhte hain.',
      'History logged-in user ke account se linked hoti hai.',
      'Images delete bhi ki ja sakti hain.',
    ],
  },
  {
    id: 'explore',
    title: 'Explore',
    keywords: ['explore', 'gallery', 'public', 'community', 'share', 'post', 'like', 'follow', 'search'],
    answer:
      'Explore page public gallery hai jahan log public uploads aur generated images search kar sakte hain, creators ko follow kar sakte hain, posts like kar sakte hain, aur share links use kar sakte hain.',
    details: [
      'Search titles, descriptions, prompts, aur creator names ke basis par hota hai.',
      'Logged-in users posts like aur creators follow kar sakte hain.',
      'Public gallery cards me creator info, source label, like count, aur share count dikhte hain.',
      'Dashboard community tab se apni image public Explore me publish ki ja sakti hai.',
    ],
  },
  {
    id: 'profile',
    title: 'Profile',
    keywords: ['profile', 'username', 'avatar', 'public profile', 'followers', 'following', 'account details'],
    answer:
      'Profile section me username aur avatar jaise creator identity details manage ki ja sakti hain. Public profile page par creator ki public presence aur gallery bhi dikh sakti hai.',
    details: [
      'User badge se dashboard se profile tab open hota hai.',
      'Avatar aur username updates public gallery cards par bhi reflect ho sakte hain.',
      'Follow system followers aur following counts track karta hai.',
    ],
  },
  {
    id: 'assistant',
    title: 'AI Helpper',
    keywords: ['ai helpper', 'assistant', 'chat', 'voice', 'live talk', 'live call', 'speak', 'microphone'],
    answer:
      'AI Helpper website ka built-in assistant hai. Yeh Gemini ya OpenAI powered text chat me guide karta hai, website ke features samjhata hai, aur OpenAI key configured hone par live voice mode me mic ke through natural conversation ka support deta hai. Har new chat fresh start hoti hai aur assistant sirf current valid user input par respond karta hai.',
    details: [
      'Text chat website ke sections aur workflows explain karne ke liye optimized hai.',
      'Live mode me onscreen avatar ke saath AI-generated voice response mil sakta hai.',
      'Assistant user ki language style follow karne ki koshish karta hai, including Hinglish.',
      'Assistant common commands par website navigate karne, dashboard tabs kholne, aur image ya text-to-video generation trigger karne me madad kar sakta hai.',
      'Assistant widget current on-screen conversation dikhata hai, lekin new chat zero memory se start hoti hai.',
      'Unclear input, ambient noise, ya accidental voice capture par assistant clear input maangta hai instead of guessing.',
      'AI Helpper ko Monu ne banaya hai. Monu 18 saal ke hain aur unki date of birth 14 April 2008 hai.',
      'Gemini ya OpenAI text provider configured hone par assistant website ke bahar ke general world questions bhi better handle kar sakta hai.',
    ],
  },
];

const normalizeText = (value = '') => String(value).toLowerCase();

const getKnowledgeBaseText = () =>
  WEBSITE_KNOWLEDGE_SECTIONS.map((section) =>
    `${section.title}: ${section.answer} ${section.details.join(' ')}`
  ).join('\n');

const getRelevantKnowledgeSections = (query = '', limit = 3) => {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery.trim()) {
    return WEBSITE_KNOWLEDGE_SECTIONS.slice(0, limit);
  }

  const scoredSections = WEBSITE_KNOWLEDGE_SECTIONS.map((section) => {
    const haystack = normalizeText(`${section.title} ${section.answer} ${section.details.join(' ')}`);
    const keywordScore = section.keywords.reduce((total, keyword) => (
      normalizedQuery.includes(normalizeText(keyword)) ? total + 4 : total
    ), 0);
    const directScore = haystack.includes(normalizedQuery) ? 10 : 0;
    const wordScore = normalizedQuery
      .split(/\s+/)
      .filter(Boolean)
      .reduce((total, word) => (haystack.includes(word) ? total + 1 : total), 0);

    return {
      ...section,
      score: keywordScore + directScore + wordScore,
    };
  })
    .filter((section) => section.score > 0)
    .sort((left, right) => right.score - left.score);

  return scoredSections.length > 0
    ? scoredSections.slice(0, limit)
    : WEBSITE_KNOWLEDGE_SECTIONS.slice(0, limit);
};

const isWebsiteQuestion = (query = '') => {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery.trim()) {
    return true;
  }

  const globalWebsiteTerms = [
    'website',
    'site',
    'app',
    'nova',
    'canvas',
    'dashboard',
    'explore',
    'profile',
    'login',
    'signup',
    'image',
    'video',
    'gallery',
    'ai helpper',
    'generator',
    'prompt',
    'history',
    'account',
  ];

  return globalWebsiteTerms.some((term) => normalizedQuery.includes(term));
};

const getFallbackReply = (query = '') => {
  if (!isWebsiteQuestion(query)) {
    return 'Abhi main world knowledge ya latest internet info nahi la pa raha kyunki OpenAI live access currently available nahi hai. Website ke features, pages, login, profile, image generation, ya video setup ke baare me poochoge to main accurate help kar sakta hoon.';
  }

  const matches = getRelevantKnowledgeSections(query, 2);
  const primary = matches[0];
  const supporting = matches[1];

  const parts = [
    primary?.answer,
    primary?.details?.[0],
  ].filter(Boolean);

  if (supporting && supporting.id !== primary?.id) {
    parts.push(supporting.answer);
  }

  return (
    parts.join(' ') ||
    'Main AI Helpper hoon. Yeh website images, videos, Explore gallery, profile management, aur creator dashboard ke around built hai.'
  );
};

module.exports = {
  WEBSITE_KNOWLEDGE_SECTIONS,
  getFallbackReply,
  getKnowledgeBaseText,
  getRelevantKnowledgeSections,
  isWebsiteQuestion,
};
