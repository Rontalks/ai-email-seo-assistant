// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getPageContent') {
    // 获取页面内容
    const content = {
      title: document.title,
      url: window.location.href,
      language: document.documentElement.lang || detectPageLanguage() || 'en',
      companyInfo: extractCompanyInfo(),
      productInfo: extractProductInfo(),
      mainContent: extractMainContent()
    };
    
    sendResponse(content);
  }
});

// 检测页面语言
function detectPageLanguage() {
  // 尝试从 meta 标签获取语言信息
  const metaLanguage = document.querySelector('meta[http-equiv="content-language"]');
  if (metaLanguage) {
    return metaLanguage.getAttribute('content');
  }

  // 尝试从页面内容检测语言
  const text = document.body.innerText;
  // 简单的语言检测逻辑
  const hasChineseChars = /[\u4E00-\u9FFF]/.test(text);
  const hasJapaneseChars = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
  const hasKoreanChars = /[\u3130-\u318F\uAC00-\uD7AF]/.test(text);

  if (hasChineseChars) return 'zh';
  if (hasJapaneseChars) return 'ja';
  if (hasKoreanChars) return 'ko';
  return 'en';
}

// 提取公司信息
function extractCompanyInfo() {
  return {
    name: extractText('[itemtype*="Organization"] [itemprop="name"], .company-name, #company-name, .about-company h1'),
    description: extractText('[itemtype*="Organization"] [itemprop="description"], .company-description, .about-company p'),
    website: extractText('[itemtype*="Organization"] [itemprop="url"], .company-website'),
    email: extractText('[itemtype*="Organization"] [itemprop="email"], .contact-email'),
    phone: extractText('[itemtype*="Organization"] [itemprop="telephone"], .contact-phone'),
    address: extractText('[itemtype*="Organization"] [itemprop="address"], .company-address')
  };
}

// 提取产品信息
function extractProductInfo() {
  return {
    name: extractText('[itemtype*="Product"] [itemprop="name"], .product-name, .product-title'),
    description: extractText('[itemtype*="Product"] [itemprop="description"], .product-description'),
    price: extractText('[itemtype*="Product"] [itemprop="price"], .product-price'),
    features: Array.from(document.querySelectorAll('.product-features li, .features li')).map(el => el.textContent.trim())
  };
}

// 提取主要内容
function extractMainContent() {
  const mainContent = document.querySelector('main') || 
                     document.querySelector('article') || 
                     document.querySelector('.content') ||
                     document.body;
  
  const clonedContent = mainContent.cloneNode(true);
  const elementsToRemove = clonedContent.querySelectorAll('script, style, nav, footer, header, aside, .ads, .comments');
  elementsToRemove.forEach(element => element.remove());
  
  return clonedContent.innerText.replace(/\s+/g, ' ').trim();
}

// 辅助函数：提取文本内容
function extractText(selectors) {
  const element = document.querySelector(selectors);
  return element ? element.textContent.trim() : '';
} 