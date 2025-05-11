import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Tabs, Tooltip } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyOutlined, InfoCircleOutlined } from '@ant-design/icons';
import './Login.css';
import axios from 'axios';

const { TabPane } = Tabs;

// 创建一个独立的axios实例，不受全局配置影响
const createAxiosInstance = () => {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      const baseURL = `${protocol}//${hostname}:5000`;
      // console.log('Login组件使用的API地址:', baseURL);

      // 在UI上显示当前使用的API地址（调试用）
      // window.currentApiUrl = baseURL;

      return axios.create({
            baseURL,
            withCredentials: true
      });
};

// Remove mock user data; use backend APIs for auth

const Login = ({ onLoginSuccess }) => {
      const [activeTab, setActiveTab] = useState('login');
      const [loading, setLoading] = useState(false);
      // Create separate form instances for login and register
      const [loginForm] = Form.useForm();
      const [registerForm] = Form.useForm();

      // 获取并显示API URL信息
      useEffect(() => {
      }, []);

      // Reset form fields when switching tabs
      useEffect(() => {
            if (activeTab === 'login') {
                  loginForm.resetFields();
            } else {
                  registerForm.resetFields();
            }
      }, [activeTab, loginForm, registerForm]);

      // 使用本地图片
      const pcbBackgroundUrl = '/output.png';

      // Real backend login
      const handleLogin = async (values) => {
            setLoading(true);
            let axiosInstance;
            try {
                  // 使用独立的axios实例发起请求
                  axiosInstance = createAxiosInstance();
                  // console.log('开始登录请求，API地址:', axiosInstance.defaults.baseURL);

                  // 添加超时和错误处理
                  const response = await axiosInstance.post('/api/login', values, {
                        timeout: 10000  // 10秒超时
                  });

                  const data = response.data;
                  if (data.status === 'success') {
                        message.success('登录成功！');
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('user', JSON.stringify(data.user));
                        onLoginSuccess(data.user);
                  } else {
                        message.error(data.error || '登录失败');
                  }
            } catch (error) {
                  console.error('登录请求出错:', error);

                  // 详细的错误处理
                  if (error.code === 'ECONNABORTED') {
                        message.error('请求超时，服务器未响应');
                  } else if (error.message && error.message.includes('Network Error')) {
                        message.error(`网络错误: 无法连接到服务器 ${axiosInstance.defaults.baseURL}`);
                  } else if (error.response) {
                        // 服务器返回了错误状态码
                        message.error(`服务器错误 (${error.response.status}): ${error.response.data.error || '未知错误'}`);
                  } else {
                        // 其他错误
                        message.error(`登录失败: ${error.message || '未知错误'}`);
                  }
            } finally {
                  setLoading(false);
            }
      };

      // Real backend registration
      const handleRegister = async (values) => {
            setLoading(true);
            let axiosInstance;
            try {
                  // 调用注册接口，使用独立的axios实例
                  axiosInstance = createAxiosInstance();
                  // console.log('开始注册请求，API地址:', axiosInstance.defaults.baseURL);

                  // 添加超时和错误处理
                  await axiosInstance.post('/api/register', {
                        username: values.username,
                        password: values.password,
                        email: values.email,
                        phone: values.phone
                  }, {
                        timeout: 10000 // 10秒超时
                  });

                  // 注册成功后跳转到登录标签
                  message.success('注册成功！请登录');
                  setActiveTab('login');
                  // 在切换到登录标签后，预填充表单字段
                  loginForm.setFieldsValue({ username: values.username, password: values.password });
            } catch (error) {
                  console.error('注册请求出错:', error);

                  // 详细的错误处理
                  if (error.code === 'ECONNABORTED') {
                        message.error('请求超时，服务器未响应');
                  } else if (error.message && error.message.includes('Network Error')) {
                        message.error(`网络错误: 无法连接到服务器 ${axiosInstance.defaults.baseURL}`);
                  } else if (error.response) {
                        // 服务器返回了错误状态码
                        message.error(`服务器错误 (${error.response.status}): ${error.response.data.error || '未知错误'}`);
                  } else {
                        // 其他错误
                        message.error(`注册失败: ${error.message || '未知错误'}`);
                  }
            } finally {
                  setLoading(false);
            }
      };

      return (
            <div className="login-container" style={{
                  backgroundImage: `url(${pcbBackgroundUrl})`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center center',
                  backgroundSize: 'cover'
            }}>
                  <div className="login-content">
                        <div className="login-header">
                              <h1>欢迎使用慧眼识瑕系统</h1>
                              <p className="login-subtitle">基于YOLOv11和投票融合的PCB缺陷检测系统</p>
                        </div>

                        <div className="login-box">
                              <div className="light-effect"></div>
                              <div className="light-effect"></div>

                              <Tabs activeKey={activeTab} onChange={setActiveTab} centered className="login-tabs">
                                    <TabPane tab="登录" key="login">
                                          <div className="login-welcome">
                                                <SafetyOutlined className="login-welcome-icon" />
                                                <p>请输入您的账号信息，安全登录系统</p>
                                          </div>
                                          <Form
                                                form={loginForm}
                                                name="login"
                                                onFinish={handleLogin}
                                                layout="vertical"
                                                size="large"
                                          >
                                                <Form.Item
                                                      name="username"
                                                      rules={[{ required: true, message: '请输入用户名' }]}
                                                >
                                                      <Input
                                                            prefix={<UserOutlined />}
                                                            placeholder="用户名"
                                                            suffix={
                                                                  <Tooltip title="支持字母、数字和下划线组合">
                                                                        <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                                                                  </Tooltip>
                                                            }
                                                      />
                                                </Form.Item>
                                                <Form.Item
                                                      name="password"
                                                      rules={[{ required: true, message: '请输入密码' }]}
                                                >
                                                      <Input.Password
                                                            prefix={<LockOutlined />}
                                                            placeholder="密码"
                                                      />
                                                </Form.Item>
                                                <Form.Item>
                                                      <Button
                                                            type="primary"
                                                            htmlType="submit"
                                                            block
                                                            loading={loading}
                                                            className="login-button"
                                                      >
                                                            登录
                                                      </Button>
                                                </Form.Item>
                                          </Form>
                                    </TabPane>
                                    <TabPane tab="注册" key="register">
                                          <div className="login-welcome">
                                                <UserOutlined className="login-welcome-icon" style={{ color: '#1890ff' }} />
                                                <p>欢迎注册，请填写以下信息</p>
                                          </div>
                                          <Form
                                                form={registerForm}
                                                name="register"
                                                onFinish={handleRegister}
                                                layout="vertical"
                                                size="large"
                                          >
                                                <Form.Item
                                                      name="username"
                                                      rules={[{ required: true, message: '请输入用户名' }]}
                                                >
                                                      <Input
                                                            prefix={<UserOutlined />}
                                                            placeholder="用户名"
                                                            suffix={
                                                                  <Tooltip title="支持字母、数字和下划线组合">
                                                                        <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                                                                  </Tooltip>
                                                            }
                                                      />
                                                </Form.Item>
                                                <Form.Item
                                                      name="email"
                                                      rules={[
                                                            { required: true, message: '请输入邮箱' },
                                                            { type: 'email', message: '请输入有效的邮箱地址' }
                                                      ]}
                                                >
                                                      <Input
                                                            prefix={<MailOutlined />}
                                                            placeholder="邮箱"
                                                      />
                                                </Form.Item>
                                                <Form.Item
                                                      name="phone"
                                                      rules={[
                                                            { required: true, message: '请输入手机号' },
                                                            { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }
                                                      ]}
                                                >
                                                      <Input
                                                            prefix={<PhoneOutlined />}
                                                            placeholder="手机号"
                                                      />
                                                </Form.Item>
                                                <Form.Item
                                                      name="password"
                                                      rules={[
                                                            { required: true, message: '请输入密码' },
                                                            { min: 6, message: '密码长度至少为6位' }
                                                      ]}
                                                >
                                                      <Input.Password
                                                            prefix={<LockOutlined />}
                                                            placeholder="密码"
                                                      />
                                                </Form.Item>
                                                <Form.Item
                                                      name="confirmPassword"
                                                      dependencies={['password']}
                                                      rules={[
                                                            { required: true, message: '请确认密码' },
                                                            ({ getFieldValue }) => ({
                                                                  validator(_, value) {
                                                                        if (!value || getFieldValue('password') === value) {
                                                                              return Promise.resolve();
                                                                        }
                                                                        return Promise.reject(new Error('两次输入的密码不一致'));
                                                                  },
                                                            }),
                                                      ]}
                                                >
                                                      <Input.Password
                                                            prefix={<LockOutlined />}
                                                            placeholder="确认密码"
                                                      />
                                                </Form.Item>
                                                <Form.Item>
                                                      <Button
                                                            type="primary"
                                                            htmlType="submit"
                                                            block
                                                            loading={loading}
                                                            className="login-button"
                                                      >
                                                            注册
                                                      </Button>
                                                </Form.Item>
                                          </Form>
                                    </TabPane>
                              </Tabs>

                              <div className="login-footer">
                                    <p>技术支持: <span>从零开始的代码生活</span></p>
                                    <p>系统版本: <span>V2.3.1</span></p>
                              </div>
                        </div>
                  </div>
            </div>
      );
};

export default Login; 