import axios from 'axios';

const API_URL = (() => {
      // 始终使用当前窗口的location来构建API URL
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      return `${protocol}//${hostname}:5000/api`;
})();

// 创建axios实例
const axiosInstance = axios.create({
      baseURL: API_URL
});

// 添加请求拦截器
axiosInstance.interceptors.request.use(
      (config) => {
            const user = getCurrentUser();
            if (user && user.token) {
                  config.headers.Authorization = `Bearer ${user.token}`;
            }
            return config;
      },
      (error) => {
            return Promise.reject(error);
      }
);

// 添加响应拦截器
axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
            if (error.response && error.response.status === 401) {
                  // token过期或无效，清除用户信息并跳转到登录页
                  logout();
                  window.location.href = '/login';
            }
            return Promise.reject(error);
      }
);

export const login = async (username, password) => {
      try {
            const response = await axiosInstance.post('/login', { username, password });
            if (response.data.token) {
                  localStorage.setItem('user', JSON.stringify(response.data));
            }
            return response.data;
      } catch (error) {
            // 确保抛出的错误是标准对象
            throw error.response?.data || { error: '登录失败，请检查网络或服务器状态' };
      }
};

export const register = async (username, email, password) => {
      try {
            const response = await axiosInstance.post('/register', {
                  username,
                  email,
                  password
            });
            return response.data;
      } catch (error) {
            throw error.response.data;
      }
};

export const logout = () => {
      localStorage.removeItem('user');
};

export const getCurrentUser = () => {
      return JSON.parse(localStorage.getItem('user'));
};

// 导出axios实例供其他服务使用
export const api = axiosInstance;