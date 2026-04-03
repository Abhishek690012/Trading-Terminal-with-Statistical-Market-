import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080',
  timeout: 5000,
});

export const fetchMarketStatus = async () => {
  // const response = await api.get('/status');
  // return response.data;
  return { status: 'open' };
};

export default api;
