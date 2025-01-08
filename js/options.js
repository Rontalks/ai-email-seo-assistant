document.addEventListener('DOMContentLoaded', function() {
  const apiProvider = document.getElementById('apiProvider');
  const baseUrlInput = document.getElementById('baseUrl');
  const modelNameInput = document.getElementById('modelName');

  // 加载保存的设置
  chrome.storage.sync.get([
    'apiProvider',
    'baseUrl',
    'apiKey',
    'modelName',
    'emailRolePrompt',
    'seoRolePrompt',
    'keywordsCount',
    'articleLength'
  ], function(data) {
    if (data.apiProvider) {
      document.getElementById('apiProvider').value = data.apiProvider;
    }
    if (data.baseUrl) {
      baseUrlInput.value = data.baseUrl;
    }
    if (data.apiKey) {
      document.getElementById('apiKey').value = data.apiKey;
    }
    if (data.modelName) {
      modelNameInput.value = data.modelName;
    }
    if (data.emailRolePrompt) {
      document.getElementById('emailRolePrompt').value = data.emailRolePrompt;
    }
    if (data.seoRolePrompt) {
      document.getElementById('seoRolePrompt').value = data.seoRolePrompt;
    }
    if (data.keywordsCount) {
      document.getElementById('keywordsCount').value = data.keywordsCount;
    }
    if (data.articleLength) {
      document.getElementById('articleLength').value = data.articleLength;
    }
  });

  // 保存设置
  document.getElementById('saveButton').addEventListener('click', function() {
    const apiProvider = document.getElementById('apiProvider').value;
    const baseUrl = baseUrlInput.value;
    const apiKey = document.getElementById('apiKey').value;
    const modelName = modelNameInput.value;
    const emailRolePrompt = document.getElementById('emailRolePrompt').value;
    const seoRolePrompt = document.getElementById('seoRolePrompt').value;
    const keywordsCount = document.getElementById('keywordsCount').value;
    const articleLength = document.getElementById('articleLength').value;

    // 验证必填字段
    if (!apiKey || !baseUrl || !modelName) {
      alert('Please enter API Key, Base URL and Model Name');
      return;
    }

    chrome.storage.sync.set({
      apiProvider: apiProvider,
      baseUrl: baseUrl,
      apiKey: apiKey,
      modelName: modelName,
      emailRolePrompt: emailRolePrompt,
      seoRolePrompt: seoRolePrompt,
      keywordsCount: keywordsCount,
      articleLength: articleLength
    }, function() {
      alert('Settings saved successfully!');
    });
  });
}); 