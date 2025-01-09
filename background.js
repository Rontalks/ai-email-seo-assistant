// API调用处理
async function callAI(messages, apiProvider, apiKey) {
  const settings = await chrome.storage.sync.get(['baseUrl', 'modelName']);
  const baseURL = settings.baseUrl;
  const model = settings.modelName;

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'generateEmail') {
    handleEmailGeneration(request.pageContent)
      .then(response => sendResponse({success: true, data: response}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }
  
  if (request.type === 'chatMessage') {
    handleChatMessage(request.message)
      .then(response => sendResponse({success: true, data: response}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }

  if (request.type === 'extractKeywords') {
    handleKeywordsExtraction(request.pageContent)
      .then(response => sendResponse({success: true, data: response}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }

  if (request.type === 'generateArticle') {
    handleArticleGeneration(request.pageContent, request.keywords)
      .then(response => sendResponse({success: true, data: response}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }

  if (request.type === 'expandKeywords') {
    handleKeywordsExpansion(request.keywords, request.pageContent)
      .then(response => sendResponse({success: true, data: response}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }
});

async function handleEmailGeneration(pageContent) {
  const content = JSON.parse(pageContent);
  const settings = await chrome.storage.sync.get(['apiProvider', 'apiKey', 'rolePrompt']);
  
  const prompt = `
You are an experienced international trade professional. Write a detailed and professional business development email following these specific guidelines:
Important: Return ONLY the email content without any introduction or explanation text.

Based on this page information:
- Title: ${content.title}
- URL: ${content.url}
- Company Information: ${JSON.stringify(content.companyInfo)}
- Product Information: ${JSON.stringify(content.productInfo)}
- Main Content: ${content.mainContent}

Write a business development email that:
- References specific products/services from the page
- Shows understanding of their business
- Uses relevant details from their company information

Email Structure:
1. Subject Line: Create a compelling and specific subject line
2. Professional Greeting: Use appropriate business salutation
3. Opening Paragraph: 
   - Use the role information provided in the system message for self-introduction
   - Reference to their company/products specifically
   - Show clear understanding of their business
4. Main Body (2-3 paragraphs):
   - Highlight specific products/services of interest
   - Explain potential collaboration opportunities
   - Demonstrate value proposition
   - Include relevant technical or business details
5. Call to Action:
   - Clear and specific next steps
   - Suggest a meeting or call
6. Professional Closing:
   - Use the identity information from the system message
   - Contact information

Important: Do not use placeholders like [Your Name] or [Your Company]. 
Instead, use the identity information provided in the system message.

${content.language !== 'en' ? `
Format the response EXACTLY as:

=== English Email ===
Subject: [Subject line]
[Full email content with proper spacing and formatting]

=== ${content.language} Email ===
Subject: [Subject line]
[Full email content with proper spacing and formatting]

Note: Do not include any other text, explanations, or introductions before or after the email content.
` : ''}
`;

  const messages = [
    {
      role: 'system',
      content: `${settings.rolePrompt || 'You are a professional international trade expert.'} 
      Important: Use this role information for the email signature and self-introduction. 
      Do not use placeholders like [Your Name] or [Your Company].`
    },
    {role: 'user', content: prompt}
  ];

  return await callAI(messages, settings.apiProvider, settings.apiKey);
}

async function handleChatMessage(message) {
  const settings = await chrome.storage.sync.get(['apiProvider', 'apiKey', 'rolePrompt']);
  
  const messages = [
    {role: 'system', content: settings.rolePrompt || 'You are a helpful assistant.'},
    {role: 'user', content: message}
  ];

  return await callAI(messages, settings.apiProvider, settings.apiKey);
}

// 处理关键词提取
async function handleKeywordsExtraction(pageContent) {
  const content = JSON.parse(pageContent);
  const settings = await chrome.storage.sync.get(['apiProvider', 'apiKey', 'seoRolePrompt']);
  
  const prompt = `
  You are an SEO expert. Based on the following content, extract the most relevant keywords:

  Content:
  Title: ${content.title}
  URL: ${content.url}
  Company Info: ${JSON.stringify(content.companyInfo)}
  Product Info: ${JSON.stringify(content.productInfo)}
  Main Content: ${content.mainContent}

  Requirements:
  1. Focus on the most important and relevant keywords only
  2. Include:
     - Main product/service names
     - Key technical terms
     - Important brand names
     - Industry-specific terms
  3. Limit to 5-8 most critical keywords
  4. Format your response as a simple comma-separated list
  5. Do not include any explanations or additional text
  `;

  const messages = [
    {role: 'system', content: settings.seoRolePrompt || 'You are an SEO expert.'},
    {role: 'user', content: prompt}
  ];

  const response = await callAI(messages, settings.apiProvider, settings.apiKey);
  return response.split(',').map(keyword => keyword.trim()).filter(Boolean);
}

// 处理文章生成
async function handleArticleGeneration(pageContent, keywords) {
  const content = JSON.parse(pageContent);
  const settings = await chrome.storage.sync.get([
    'apiProvider', 
    'apiKey', 
    'seoRolePrompt',
    'articleLength'
  ]);
  
  const prompt = `
You are an SEO content expert. Write an informative and engaging article using the following keywords and information:

Keywords: ${keywords.join(', ')}

Reference Content:
Title: ${content.title}
URL: ${content.url}
Company Info: ${JSON.stringify(content.companyInfo)}
Product Info: ${JSON.stringify(content.productInfo)}

Requirements:
1. Target length: ${settings.articleLength || 1000} words
2. Naturally incorporate the provided keywords
3. Use proper headings and structure
4. Focus on providing value to readers
5. Optimize for SEO while maintaining readability
6. Include a compelling introduction and conclusion
`;

  const messages = [
    {role: 'system', content: settings.seoRolePrompt || 'You are an SEO content expert.'},
    {role: 'user', content: prompt}
  ];

  return await callAI(messages, settings.apiProvider, settings.apiKey);
}

// 处理关键词扩充
async function handleKeywordsExpansion(keywords, pageContent) {
  const content = JSON.parse(pageContent);
  const settings = await chrome.storage.sync.get(['apiProvider', 'apiKey', 'seoRolePrompt', 'keywordsCount']);
  
  const prompt = `
You are an SEO expert. Analyze the existing keywords and content, then suggest additional keywords following these steps:

Step 1: Categorize existing keywords into:
- Brand/Company terms
- Product names and types
- Features and specifications
- Industry/Market terms
- User needs/Problems solved

Step 2: For each category that has fewer keywords, suggest new keywords considering:
- Search intent (informational, commercial, transactional)
- Keyword difficulty level (mix of head terms and long-tail)
- User language and common search phrases
- Related product features and benefits
- Common industry terminology

Existing Keywords: ${keywords.join(', ')}

Content Context:
Title: ${content.title}
URL: ${content.url}
Product Info: ${JSON.stringify(content.productInfo)}
Company Info: ${JSON.stringify(content.companyInfo)}
Main Content Summary: ${content.mainContent.substring(0, 500)}...

Requirements:
1. Generate ${settings.keywordsCount || 5} highly relevant new keywords
2. Include:
   - 1-2 broad industry/category terms
   - 2-3 specific product/feature terms
   - 1-2 problem-solving/benefit terms
   - 1-2 long-tail variations
3. Ensure each keyword:
   - Is directly related to the product/content
   - Has clear search intent
   - Uses natural language people actually search with
   - Adds value beyond existing keywords
4. Format response as a comma-separated list only
5. Do not repeat existing keywords

Note: Focus on commercial and transactional intent keywords that could lead to business opportunities.
`;

  const messages = [
    {role: 'system', content: settings.seoRolePrompt || 'You are an SEO expert.'},
    {role: 'user', content: prompt}
  ];

  const response = await callAI(messages, settings.apiProvider, settings.apiKey);
  return response.split(',').map(keyword => keyword.trim()).filter(Boolean);
} 