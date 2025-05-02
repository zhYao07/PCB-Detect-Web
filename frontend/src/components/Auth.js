import React, { useState } from 'react';
import axios from 'axios';
import { useHistory } from 'react-router-dom';
import {
      Box,
      Container,
      Paper,
      TextField,
      Button,
      Typography,
      Tab,
      Tabs,
      Alert,
} from '@mui/material';

const Auth = () => {
      const [tab, setTab] = useState(0);
      const [formData, setFormData] = useState({
            username: '',
            email: '',
            password: '',
      });
      const [error, setError] = useState('');
      const history = useHistory();

      const handleTabChange = (event, newValue) => {
            setTab(newValue);
            setError('');
      };

      const handleInputChange = (e) => {
            setFormData({
                  ...formData,
                  [e.target.name]: e.target.value,
            });
      };

      const handleSubmit = async (e) => {
            e.preventDefault();
            setError('');

            try {
                  if (tab === 0) { // Login
                        const response = await axios.post('http://localhost:5000/api/login', {
                              username: formData.username,
                              password: formData.password,
                        });

                        localStorage.setItem('token', response.data.access_token);
                        localStorage.setItem('user', JSON.stringify(response.data.user));
                        history.push('/');
                  } else { // Register
                        await axios.post('http://localhost:5000/api/register', formData);
                        setTab(0); // Switch to login tab after successful registration
                  }
            } catch (err) {
                  setError(err.response?.data?.error || 'An error occurred');
            }
      };

      return (
            <Container component="main" maxWidth="xs">
                  <Box
                        sx={{
                              marginTop: 8,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                        }}
                  >
                        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
                              <Typography component="h1" variant="h5" align="center" gutterBottom>
                                    PCB缺陷检测系统
                              </Typography>

                              <Tabs value={tab} onChange={handleTabChange} centered sx={{ mb: 3 }}>
                                    <Tab label="登录" />
                                    <Tab label="注册" />
                              </Tabs>

                              {error && (
                                    <Alert severity="error" sx={{ mb: 2 }}>
                                          {error}
                                    </Alert>
                              )}

                              <form onSubmit={handleSubmit}>
                                    <TextField
                                          margin="normal"
                                          required
                                          fullWidth
                                          label="用户名"
                                          name="username"
                                          value={formData.username}
                                          onChange={handleInputChange}
                                    />

                                    {tab === 1 && (
                                          <TextField
                                                margin="normal"
                                                required
                                                fullWidth
                                                label="邮箱"
                                                name="email"
                                                type="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                          />
                                    )}

                                    <TextField
                                          margin="normal"
                                          required
                                          fullWidth
                                          label="密码"
                                          name="password"
                                          type="password"
                                          value={formData.password}
                                          onChange={handleInputChange}
                                    />

                                    <Button
                                          type="submit"
                                          fullWidth
                                          variant="contained"
                                          sx={{ mt: 3, mb: 2 }}
                                    >
                                          {tab === 0 ? '登录' : '注册'}
                                    </Button>
                              </form>
                        </Paper>
                  </Box>
            </Container>
      );
};

export default Auth; 