document.addEventListener('DOMContentLoaded', function() {
  const settingsButton = document.getElementById('settingsButton');
  const generateButton = document.getElementById('generateButton');
  const regenerateButton = document.getElementById('regenerateButton');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const emailContent = document.getElementById('emailContent');
  const chatMessages = document.getElementById('chatMessages');
  const pageContent = document.getElementById('pageContent');
  const extractKeywordsBtn = document.getElementById('extractKeywordsBtn');
  const expandKeywordsBtn = document.getElementById('expandKeywordsBtn');
  const keywordsInput = document.getElementById('keywordsInput');
  const keywordsList = document.getElementById('keywordsList');
  const generateArticleBtn = document.getElementById('generateArticleBtn');
  const regenerateArticleBtn = document.getElementById('regenerateArticleBtn');

  // 打开设置页面
  settingsButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  // 获取当前页面信息
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'getPageContent' }, function(response) {
      if (response) {
        // 保存完整响应以供生成邮件时使用
        window.pageData = response;
      }
    });
  });

  // 生成邮件
  generateButton.addEventListener('click', async function() {
    if (!window.pageData) {
      showNotification('No page content found. Please try refreshing the page.', 'error');
      return;
    }
    
    const pageText = JSON.stringify(window.pageData);
    generateButton.disabled = true;
    
    try {
      // 检查是否配置了API
      const settings = await chrome.storage.sync.get(['apiProvider', 'apiKey']);
      if (!settings.apiKey) {
        throw new Error('Please configure your API key in the settings first.');
      }

      showNotification('Generating email...', 'info');
      const response = await generateEmail(pageText);
      displayEmails(response);
      showNotification('Email generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating email:', error);
      showNotification(error.message, 'error');
    } finally {
      generateButton.disabled = false;
    }
  });

  // 重新生成邮件
  regenerateButton.addEventListener('click', async function() {
    const pageText = JSON.stringify(window.pageData);
    regenerateButton.disabled = true;
    
    try {
      const response = await generateEmail(pageText);
      displayEmails(response);
      showNotification('Email regenerated successfully!', 'success');
    } catch (error) {
      console.error('Error regenerating email:', error);
      showNotification('Failed to regenerate email', 'error');
    } finally {
      regenerateButton.disabled = false;
    }
  });

  // 发送聊天消息
  sendButton.addEventListener('click', async function() {
    const message = messageInput.value.trim();
    if (!message) return;

    addMessage('user', message);
    messageInput.value = '';

    try {
      const response = await sendChatMessage(message);
      addMessage('ai', response);
    } catch (error) {
      console.error('Error sending message:', error);
      addMessage('ai', 'Sorry, there was an error processing your message.');
    }
  });

  // 添加消息到聊天框
  function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // 生成邮件的函数
  async function generateEmail(pageText) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { 
          type: 'generateEmail', 
          pageContent: pageText 
        },
        response => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  // 发送聊天消息的函数
  async function sendChatMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { 
          type: 'chatMessage', 
          message: message 
        },
        response => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  // 添加回车键发送消息的功能
  messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendButton.click();
    }
  });

  // 优化页面内容提取逻辑
  function getPageContent() {
    // 获取页面主要内容
    const content = {
      title: document.title,
      url: window.location.href,
      language: document.documentElement.lang || 'en', // 获取页面语言
      companyInfo: {},
      productInfo: {},
      mainContent: ''
    };
    
    // 尝试获取主要内容区域
    const mainContent = document.querySelector('main') || 
                       document.querySelector('article') || 
                       document.querySelector('.content') ||
                       document.body;
    
    // 移除不需要的元素
    const clonedContent = mainContent.cloneNode(true);
    const elementsToRemove = clonedContent.querySelectorAll('script, style, nav, footer, header, aside, .ads, .comments');
    elementsToRemove.forEach(element => element.remove());
    
    // 提取公司信息
    content.companyInfo = {
      name: extractText('[itemtype*="Organization"] [itemprop="name"], .company-name, #company-name, .about-company h1'),
      description: extractText('[itemtype*="Organization"] [itemprop="description"], .company-description, .about-company p'),
      website: extractText('[itemtype*="Organization"] [itemprop="url"], .company-website'),
      email: extractText('[itemtype*="Organization"] [itemprop="email"], .contact-email'),
      phone: extractText('[itemtype*="Organization"] [itemprop="telephone"], .contact-phone'),
      address: extractText('[itemtype*="Organization"] [itemprop="address"], .company-address')
    };
    
    // 提取产品信息
    content.productInfo = {
      name: extractText('[itemtype*="Product"] [itemprop="name"], .product-name, .product-title'),
      description: extractText('[itemtype*="Product"] [itemprop="description"], .product-description'),
      price: extractText('[itemtype*="Product"] [itemprop="price"], .product-price'),
      features: Array.from(document.querySelectorAll('.product-features li, .features li')).map(el => el.textContent.trim())
    };
    
    // 获取清理后的主要文本内容
    content.mainContent = clonedContent.innerText
      .replace(/\s+/g, ' ')
      .trim();
    
    return content;
  }

  // 辅助函数：提取文本内容
  function extractText(selectors) {
    const element = document.querySelector(selectors);
    return element ? element.textContent.trim() : '';
  }

  // 添加一个通知系统
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }

  // 修改邮件显示逻辑
  function displayEmails(response) {
    const emails = response.split(/===\s.*?Email\s===/).filter(Boolean);
    if (emails.length >= 1) {
      // 格式化邮件内容
      const formatEmail = (content) => {
        return content
          .trim()
          .split('\n')
          .map(line => line.trim())
          .filter(line => line)
          .join('\n\n');
      };
      
      // 显示英文邮件
      document.getElementById('englishEmail').textContent = formatEmail(emails[0]);
      
      // 如果有其他语言的邮件，显示在第二个框中
      if (emails.length >= 2) {
        document.getElementById('otherEmail').textContent = formatEmail(emails[1]);
      }
      
      // 启用重新生成按钮
      regenerateButton.disabled = false;
    }
  }

  // 语言切换逻辑
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', function() {
      // 更新按钮状态
      document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      // 更新邮件显示
      const lang = this.dataset.lang;
      document.querySelectorAll('.email-box-container').forEach(container => {
        container.classList.remove('active');
      });
      
      if (lang === 'en') {
        document.querySelector('.email-box-container:first-child').classList.add('active');
      } else {
        document.querySelector('.email-box-container:last-child').classList.add('active');
      }
    });
  });

  // 添加复制功能
  document.querySelectorAll('.copy-button').forEach(button => {
    button.addEventListener('click', function() {
      const targetId = this.dataset.target;
      const emailContent = document.getElementById(targetId).textContent;
      
      navigator.clipboard.writeText(emailContent).then(() => {
        // 显示复制成功提示
        showNotification('Email content copied!', 'success');
        
        // 显示复制动画
        this.textContent = '✓';
        setTimeout(() => {
          this.textContent = '📋';
        }, 1000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy email content', 'error');
      });
    });
  });

  // 添加功能切换逻辑
  document.querySelectorAll('.function-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      // 更新标签状态
      document.querySelectorAll('.function-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // 更新内容显示
      const functionType = this.dataset.function;
      document.querySelectorAll('.function-content').forEach(content => {
        content.classList.remove('active');
      });
      document.querySelector(`.${functionType}-content`).classList.add('active');
    });
  });

  // 提取关键词功能
  extractKeywordsBtn.addEventListener('click', async function() {
    if (!window.pageData) {
      showNotification('No page content found. Please try refreshing the page.', 'error');
      return;
    }
    
    extractKeywordsBtn.disabled = true;
    try {
      showNotification('Extracting keywords...', 'info');
      const response = await chrome.runtime.sendMessage({
        type: 'extractKeywords',
        pageContent: JSON.stringify(window.pageData)
      });
      
      if (response.success) {
        displayKeywords(response.data);
        showNotification('Keywords extracted successfully!', 'success');
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error extracting keywords:', error);
      showNotification(error.message, 'error');
    } finally {
      extractKeywordsBtn.disabled = false;
    }
  });

  // 显示关键词
  function displayKeywords(keywords) {
    keywordsList.innerHTML = '';
    keywords.forEach(keyword => {
      const tag = document.createElement('div');
      tag.className = 'keyword-tag';
      // 创建关键词文本元素
      const keywordText = document.createElement('span');
      keywordText.textContent = keyword;
      tag.appendChild(keywordText);
      
      // 创建删除按钮
      const removeBtn = document.createElement('span');
      removeBtn.className = 'remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        tag.remove();
      });
      tag.appendChild(removeBtn);
      
      keywordsList.appendChild(tag);
    });
  }

  // 手动添加关键词
  const addKeywordBtn = document.getElementById('addKeywordBtn');
  addKeywordBtn.addEventListener('click', function() {
    const keyword = keywordsInput.value.trim();
    if (keyword) {
      addKeywordTag(keyword);
      keywordsInput.value = '';
    }
  });

  // 辅助函数：添加关键词标签
  function addKeywordTag(keyword) {
    const tag = document.createElement('div');
    tag.className = 'keyword-tag';
    
    // 创建关键词文本元素
    const keywordText = document.createElement('span');
    keywordText.textContent = keyword;
    tag.appendChild(keywordText);
    
    // 创建删除按钮
    const removeBtn = document.createElement('span');
    removeBtn.className = 'remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      tag.remove();
    });
    tag.appendChild(removeBtn);
    
    keywordsList.appendChild(tag);
  }

  // 扩充关键词功能
  expandKeywordsBtn.addEventListener('click', async function() {
    // 获取当前所有关键词
    const currentKeywords = Array.from(keywordsList.querySelectorAll('.keyword-tag'))
      .map(tag => tag.firstChild.textContent.trim());
    
    if (currentKeywords.length === 0) {
      showNotification('请先提取或添加一些关键词', 'error');
      return;
    }
    
    expandKeywordsBtn.disabled = true;
    try {
      showNotification('正在扩充关键词...', 'info');
      const response = await chrome.runtime.sendMessage({
        type: 'expandKeywords',
        keywords: currentKeywords,
        pageContent: JSON.stringify(window.pageData)
      });
      
      if (response.success) {
        // 添加新的关键词
        response.data.forEach(keyword => {
          if (!currentKeywords.includes(keyword)) {
            addKeywordTag(keyword);
          }
        });
        showNotification('关键词扩充成功！', 'success');
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error expanding keywords:', error);
      showNotification(error.message, 'error');
    } finally {
      expandKeywordsBtn.disabled = false;
    }
  });

  // 生成文章功能
  generateArticleBtn.addEventListener('click', async function() {
    // 获取所有当前显示的关键词
    const keywords = Array.from(keywordsList.querySelectorAll('.keyword-tag'))
      .map(tag => tag.firstChild.textContent.trim());
    
    if (keywords.length === 0) {
      showNotification('Please add some keywords first', 'error');
      return;
    }

    generateArticleBtn.disabled = true;
    try {
      showNotification('Generating article...', 'info');
      const response = await chrome.runtime.sendMessage({
        type: 'generateArticle',
        pageContent: JSON.stringify(window.pageData),
        keywords: keywords
      });

      if (response.success) {
        document.getElementById('articleContent').textContent = response.data;
        regenerateArticleBtn.disabled = false;
        showNotification('Article generated successfully!', 'success');
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error generating article:', error);
      showNotification(error.message, 'error');
    } finally {
      generateArticleBtn.disabled = false;
    }
  });

  // 重新生成文章功能
  regenerateArticleBtn.addEventListener('click', async function() {
    const keywords = Array.from(keywordsList.querySelectorAll('.keyword-tag'))
      .map(tag => tag.firstChild.textContent.trim());
    
    regenerateArticleBtn.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'generateArticle',
        pageContent: JSON.stringify(window.pageData),
        keywords: keywords
      });

      if (response.success) {
        document.getElementById('articleContent').textContent = response.data;
        showNotification('Article regenerated successfully!', 'success');
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error regenerating article:', error);
      showNotification('Failed to regenerate article', 'error');
    } finally {
      regenerateArticleBtn.disabled = false;
    }
  });
}); 