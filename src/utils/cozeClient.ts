import { CozeAPI, COZE_CN_BASE_URL } from '@coze/api';

// 使用个人访问令牌初始化客户端，并允许在浏览器中使用
const cozeClient = new CozeAPI({
  token: 'pat_jXru7dZaXrbFeVPW4kMCPriiWRsQO8MVJKonbiGbBtZAUGNlxmRpKMZDHrCuF2uR', // 确保替换为您的实际 PAT
  baseURL: COZE_CN_BASE_URL,
  allowPersonalAccessTokenInBrowser: true, // 允许在浏览器中使用 PAT
});

export default cozeClient; 