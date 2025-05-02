import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../services/auth';

const { Title } = Typography;

const Register = () => {
      const [loading, setLoading] = useState(false);
      const navigate = useNavigate();

      const onFinish = async (values) => {
            if (values.password !== values.confirmPassword) {
                  message.error('两次输入的密码不一致！');
                  return;
            }

            setLoading(true);
            try {
                  await register(values.username, values.email, values.password);
                  message.success('注册成功！请登录');
                  navigate('/login');
            } catch (error) {
                  message.error(error.error || '注册失败，请重试');
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
                              <Title level={4}>用户注册</Title>
                        </div>

                        <Form
                              name="register"
                              onFinish={onFinish}
                              autoComplete="off"
                              layout="vertical"
                        >
                              <Form.Item
                                    name="username"
                                    rules={[
                                          { required: true, message: '请输入用户名！' },
                                          { min: 3, message: '用户名至少3个字符！' }
                                    ]}
                              >
                                    <Input
                                          prefix={<UserOutlined />}
                                          placeholder="用户名"
                                          size="large"
                                    />
                              </Form.Item>

                              <Form.Item
                                    name="email"
                                    rules={[
                                          { required: true, message: '请输入邮箱！' },
                                          { type: 'email', message: '请输入有效的邮箱地址！' }
                                    ]}
                              >
                                    <Input
                                          prefix={<MailOutlined />}
                                          placeholder="邮箱"
                                          size="large"
                                    />
                              </Form.Item>

                              <Form.Item
                                    name="password"
                                    rules={[
                                          { required: true, message: '请输入密码！' },
                                          { min: 6, message: '密码至少6个字符！' }
                                    ]}
                              >
                                    <Input.Password
                                          prefix={<LockOutlined />}
                                          placeholder="密码"
                                          size="large"
                                    />
                              </Form.Item>

                              <Form.Item
                                    name="confirmPassword"
                                    rules={[
                                          { required: true, message: '请确认密码！' },
                                          { min: 6, message: '密码至少6个字符！' }
                                    ]}
                              >
                                    <Input.Password
                                          prefix={<LockOutlined />}
                                          placeholder="确认密码"
                                          size="large"
                                    />
                              </Form.Item>

                              <Form.Item>
                                    <Button type="primary" htmlType="submit" loading={loading} block size="large">
                                          注册
                                    </Button>
                              </Form.Item>

                              <div style={{ textAlign: 'center' }}>
                                    已有账号？ <Link to="/login">立即登录</Link>
                              </div>
                        </Form>
                  </Card>
            </div>
      );
};

export default Register; 