import axios from 'axios';

const instance = axios.create({
      baseURL: 'http://localhost:5000',
});

// 请求拦截器
instance.interceptors.request.use(
      (config) => {
            const token = localStorage.getItem('token');
            if (token) {
                  config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
      },
      (error) => {
            return Promise.reject(error);
      }
);

// 响应拦截器
instance.interceptors.response.use(
      (response) => {
            return response;
      },
      (error) => {
            if (error.response?.status === 401) {
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  window.location.href = '/auth';
            }
            return Promise.reject(error);
      }
);

export default instance; 