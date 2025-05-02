import React, { useState, useEffect } from 'react';
import { Card, Progress, Statistic } from 'antd';
import { fetchSystemStatus } from '../api';
import './SystemStatus.css';

const SystemStatus = () => {
      const [status, setStatus] = useState({
            cpu: 0,
            memory: 0,
            uptime: 0
      });

      useEffect(() => {
            const getSystemStatus = async () => {
                  try {
                        const data = await fetchSystemStatus();
                        setStatus(data);
                  } catch (error) {
                        console.error('Failed to fetch system status:', error);
                  }
            };

            getSystemStatus();
            const interval = setInterval(getSystemStatus, 5000);

            return () => clearInterval(interval);
      }, []);

      // 将秒数转换为可读的时间格式
      const formatUptime = (seconds) => {
            const days = Math.floor(seconds / (3600 * 24));
            const hours = Math.floor((seconds % (3600 * 24)) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = Math.floor(seconds % 60);

            return `${days}天 ${hours}小时 ${minutes}分钟 ${remainingSeconds}秒`;
      };

      return (
            <div className="system-status-container">
                  <Card title="系统状态" className="system-status-card">
                        <div className="status-content">
                              <div className="status-item">
                                    <Statistic title="运行时间" value={formatUptime(status.uptime)} />
                              </div>
                              <div className="status-item">
                                    <div className="status-label">CPU 使用率</div>
                                    <Progress
                                          percent={status.cpu}
                                          status={status.cpu > 90 ? 'exception' : 'normal'}
                                          strokeColor={
                                                status.cpu > 90
                                                      ? '#f5222d'
                                                      : status.cpu > 70
                                                            ? '#faad14'
                                                            : '#52c41a'
                                          }
                                          className="status-progress"
                                    />
                              </div>
                              <div className="status-item">
                                    <div className="status-label">内存使用率</div>
                                    <Progress
                                          percent={status.memory}
                                          status={status.memory > 90 ? 'exception' : 'normal'}
                                          strokeColor={
                                                status.memory > 90
                                                      ? '#f5222d'
                                                      : status.memory > 70
                                                            ? '#faad14'
                                                            : '#52c41a'
                                          }
                                          className="status-progress"
                                    />
                              </div>
                        </div>
                  </Card>
            </div>
      );
};

export default SystemStatus; 