import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// 获取系统状态信息
export const fetchSystemStatus = async () => {
      try {
            const response = await axios.get(`${API_URL}/system/status`);
            return response.data;
      } catch (error) {
            console.error('获取系统状态失败:', error);
            throw error;
      }
};

// 其他API函数可以添加在这里 