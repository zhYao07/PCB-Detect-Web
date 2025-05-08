const handleRegister = async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      try {
            const values = await registerForm.validateFields();
            const response = await axios.post('/api/register', {
                  username: values.username,
                  password: values.password,
                  email: values.email,
                  phone: values.phone
            }, {
                  headers: {
                        'Content-Type': 'application/json'
                  }
            });

            if (response.data.status === 'success') {
                  message.success('注册成功！请登录');
                  onRegisterSuccess();
            } else {
                  setError(response.data.message || '注册失败');
            }
      } catch (err) {
            console.error('注册错误:', err);
            if (err.response) {
                  setError(err.response.data.message || '注册失败，请检查输入信息');
            } else if (err.request) {
                  setError('无法连接到服务器，请检查网络连接');
            } else {
                  setError('注册过程中发生错误');
            }
      } finally {
            setLoading(false);
      }
}; 