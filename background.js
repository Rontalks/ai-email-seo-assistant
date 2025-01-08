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
  // 解析页面内容
  const content = JSON.parse(pageContent);
  
  const settings = await chrome.storage.sync.get(['apiProvider', 'apiKey', 'rolePrompt']);
  
  // 构建提示信息
  const prompt = `
You are an experienced international trade professional. Based on the following information, please write a business development email:
${content.language === 'en' ? 'Write the email in English.' : 'Write two versions of the email: one in English and one in ' + content.language}

Page Information:
- Title: ${content.title}
- URL: ${content.url}
- Company: ${JSON.stringify(content.companyInfo)}
- Product: ${JSON.stringify(content.productInfo)}
- Main Content: ${content.mainContent}

Requirements for the email:
1. Be professional and courteous
2. Reference specific details from the provided information
3. Focus on building business relationships
4. Include a clear call to action
5. Keep each email concise (150-200 words)
6. Use proper email format:
   - Subject line
   - Greeting
   - Introduction paragraph
   - Main content (2-3 paragraphs)
   - Call to action
   - Professional closing
${content.language !== 'en' ? `
7. Format the response as:

=== English Email ===
Subject: [Subject line]
[Full email content with proper spacing]

=== ${content.language} Email ===
Subject: [Subject line]
[Full email content with proper spacing]` : ''}
`;

  const messages = [
    {role: 'system', content: settings.rolePrompt || 'You are a professional international trade expert.'},
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
You are an SEO expert. Analyze this content and:

1. First, identify the core topic and main focus of the content.

2. Then, extract ONLY the most essential keywords by following these rules:
  - Focus on the primary product/service/solution (max 2-3 terms)
  - Include the main industry or sector term (1-2 terms)
  - Add the key technological or methodological terms (2-3 terms)
  - Include the brand name if significant

Important:
- Extract only keywords that are absolutely central to the content
- Limit to 5-7 most critical keywords total
- Prioritize specific, technical terms over generic ones
- Each keyword should be directly related to the core topic

Format your response as follows:

Summary:
[One sentence describing the core topic]

Keywords:
[Comma-separated list of 5-7 most essential keywords, ordered by importance]

Note: These should be the absolute core keywords that best represent the content's focus.

Content:
Title: ${content.title}
URL: ${content.url}
Company Info: ${JSON.stringify(content.companyInfo)}
Product Info: ${JSON.stringify(content.productInfo)}
Main Content: ${content.mainContent}
`;

  const messages = [
    {role: 'system', content: settings.seoRolePrompt || 'You are an SEO expert.'},
    {role: 'user', content: prompt}
  ];

  const response = await callAI(messages, settings.apiProvider, settings.apiKey);
  // 从响应中提取关键词部分
  const keywordsMatch = response.match(/Keywords:\s*\n([\s\S]+)$/);
  if (keywordsMatch && keywordsMatch[1]) {
    return keywordsMatch[1].split(',').map(keyword => keyword.trim()).filter(Boolean);
  }
  throw new Error('Failed to extract keywords from the response');
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