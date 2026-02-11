// 测试环境变量是否正确传递
console.error('环境变量测试:');
console.error('SEARXNG_URL:', process.env.SEARXNG_URL || '未设置');
console.error('NODE_ENV:', process.env.NODE_ENV || '未设置');
console.error('MAX_RESULTS:', process.env.MAX_RESULTS || '未设置');
console.error('TIMEOUT:', process.env.TIMEOUT || '未设置');
console.error('CWD:', process.cwd());

const CONFIG = {
  searxngUrl: process.env.SEARXNG_URL || 'http://localhost:18080',
};
console.error('实际使用 URL:', CONFIG.searxngUrl);
