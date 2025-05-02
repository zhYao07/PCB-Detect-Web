import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../services/auth';

const { Title } = Typography;

const Login = () => {
      const [loading, setLoading] = useState(false);
      const navigate = useNavigate();

      const onFinish = async (values) => {
            setLoading(true);
            try {
                  await login(values.username, values.password);
                  message.success('登录成功！');
                  navigate('/dashboard');
            } catch (error) {
                  message.error(error.error || '登录失败，请重试');
            } finally {
                  setLoading(false);
            }
      };

      return (
            <div style={{
                  height: '100vh',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: '#f0f2f5'
            }}>
                  <Card style={{ width: 400, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                              <Title level={2}>PCB缺陷检测系统</Title>
                              <Title level={4}>用户登录</Title>
                        </div>

                        <Form
                              name="login"
                              onFinish={onFinish}
                              autoComplete="off"
                              layout="vertical"
                        >
                              <Form.Item
                                    name="username"
                                    rules={[{ required: true, message: '请输入用户名！' }]}
                              >
                                    <Input
                                          prefix={<UserOutlined />}
                                          placeholder="用户名"
                                          size="large"
                                    />
                              </Form.Item>

                              <Form.Item
                                    name="password"
                                    rules={[{ required: true, message: '请输入密码！' }]}
                              >
                                    <Input.Password
                                          prefix={<LockOutlined />}
                                          placeholder="密码"
                                          size="large"
                                    />
                              </Form.Item>

                              <Form.Item>
                                    <Button type="primary" htmlType="submit" loading={loading} block size="large">
                                          登录
                                    </Button>
                              </Form.Item>

                              <div style={{ textAlign: 'center' }}>
                                    还没有账号？ <Link to="/register">立即注册</Link>
                              </div>
                        </Form>
                  </Card>
            </div>
      );
};

export default Login; 