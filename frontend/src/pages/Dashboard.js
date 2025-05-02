import React, { useState, useEffect, useRef } from 'react';
import { Layout, Button, Card, Statistic, Progress, Tabs, Upload, message, Select, Slider, Pagination, InputNumber, Spin } from 'antd';
import { CameraOutlined, VideoCameraOutlined, UploadOutlined, ZoomInOutlined, ZoomOutOutlined, SettingOutlined, BulbOutlined, UserOutlined, SearchOutlined, FolderOutlined, LeftOutlined, RightOutlined, LoadingOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { PlayCircleOutlined, PauseCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { api } from '../services/auth';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/auth';
import './Dashboard.css';

const { Header, Content } = Layout;

function Dashboard() {
      const navigate = useNavigate();
      const [systemStatus, setSystemStatus] = useState({
            status: 'normal',
            cpuUsage: 0,
            memoryUsage: 0,
            uptime: '0h 0m'
      });

      const [detectionResults, setDetectionResults] = useState({
            defects: [],
            statistics: {
                  defect_types: {}
            }
      });

      const [selectedImage, setSelectedImage] = useState(null);
      const [loading, setLoading] = useState(false);
      const [detectionProgress, setDetectionProgress] = useState(0);
      const [zoomLevel, setZoomLevel] = useState(1);
      const MIN_ZOOM = 0.5;
      const MAX_ZOOM = 2;
      const ZOOM_STEP = 0.1;

      // 添加新的状态变量
      const [imageList, setImageList] = useState([]); // 存储所有要处理的图片
      const [currentImageIndex, setCurrentImageIndex] = useState(0); // 当前处理的图片索引
      const [isBatchProcessing, setIsBatchProcessing] = useState(false); // 是否正在批量处理
      const [batchProgress, setBatchProgress] = useState(0); // 批量处理进度
      const [showNavigation, setShowNavigation] = useState(false);
      const [detectionHistory, setDetectionHistory] = useState([]); // 存储所有图片的检测结果
      const [previewUrls, setPreviewUrls] = useState([]); // 存储所有图片的URL
      const [isUploading, setIsUploading] = useState(false);
      const [isDragging, setIsDragging] = useState(false);
      const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
      const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
      const [scale, setScale] = useState(1);
      const [position, setPosition] = useState({ x: 0, y: 0 });
      const imageWrapperRef = useRef(null);
      const [isPaused, setIsPaused] = useState(false);
      const [defectFilter, setDefectFilter] = useState('all');
      const [processedResults, setProcessedResults] = useState([]);
      const [defectTypes, setDefectTypes] = useState(['all', 'mouse_bite', 'open_circuit', 'short', 'spur', 'spurious_copper']);
      const isPausedRef = useRef(false);
      const [isCameraActive, setIsCameraActive] = useState(false);
      const [videoStream, setVideoStream] = useState(null);
      const videoRef = useRef(null);
      const [isCapturing, setIsCapturing] = useState(false);
      const [captureInterval, setCaptureInterval] = useState(null);
      const [currentRunTime, setCurrentRunTime] = useState('0秒');
      const [runTimeInterval, setRunTimeInterval] = useState(null);
      const [startTime, setStartTime] = useState(null);
      const [endTime, setEndTime] = useState(null);
      const [selectedModel, setSelectedModel] = useState('yolov11');
      const [iouThreshold, setIouThreshold] = useState(0.45);
      const [confThreshold, setConfThreshold] = useState(0.25);

      // 添加登出功能
      const handleLogout = () => {
            logout();
            navigate('/login');
      };

      useEffect(() => {
            const fetchSystemStatus = async () => {
                  try {
                        const response = await api.get('/system-status');
                        setSystemStatus({
                              status: response.data.status,
                              cpuUsage: response.data.cpu_usage,
                              memoryUsage: response.data.memory_usage,
                              uptime: response.data.uptime
                        });
                  } catch (error) {
                        console.error('Error fetching system status:', error);
                        message.error('系统状态更新失败');
                  }
            };

            fetchSystemStatus();
            const statusInterval = setInterval(fetchSystemStatus, 5000);
            return () => clearInterval(statusInterval);
      }, []);

      // 处理图片上传
      const handleImageUpload = async (file) => {
            setIsUploading(true);
            try {
                  const imageUrl = URL.createObjectURL(file);
                  setImageList([file]);
                  setPreviewUrls([imageUrl]);
                  setSelectedImage(imageUrl);
                  setCurrentImageIndex(0);
                  setDetectionHistory([]);
                  setDetectionResults({
                        defects: [],
                        statistics: {
                              defect_types: {}
                        }
                  });
                  setProcessedResults([]);
                  setDetectionProgress(0);
                  setBatchProgress(0);
                  message.success('图片导入成功');
            } catch (error) {
                  console.error('图片导入错误:', error);
                  message.error('图片导入失败');
            } finally {
                  setIsUploading(false);
            }
            return false;
      };

      // 处理检测请求
      const processImage = async (file) => {
            try {
                  const formData = new FormData();
                  formData.append('image', file);

                  const response = await api.post('/detect', formData, {
                        params: {
                              vote_threshold: selectedModel === 'yolov11-vote2' ? 1 : selectedModel === 'yolov11-vote4' ? 2 : 1,
                              orientation_count: selectedModel === 'yolov11-vote2' ? 2 : selectedModel === 'yolov11-vote4' ? 4 : 1,
                              iou_threshold: iouThreshold,
                              conf_threshold: confThreshold,
                        }
                  });

                  return response.data;
            } catch (error) {
                  throw new Error(`检测失败: ${error.message}`);
            }
      };

      // 处理批量检测
      const handleBatchDetection = async () => {
            if (imageList.length === 0) {
                  message.warning('请先导入图片');
                  return;
            }

            setIsBatchProcessing(true);
            setLoading(true);

            try {
                  const result = await processImage(imageList[currentImageIndex]);
                  setDetectionResults(result);
                  message.success('检测完成');
            } catch (error) {
                  message.error(error.message);
            } finally {
                  setLoading(false);
                  setIsBatchProcessing(false);
            }
      };

      // 获取每种缺陷类型的颜色
      const getDefectColor = (defectType) => {
            const colorMap = {
                  'mouse_bite': '#ff7875',
                  'open_circuit': '#40a9ff',
                  'short': '#ffc53d',
                  'spur': '#73d13d',
                  'spurious_copper': '#9254de'
            };
            return colorMap[defectType.toLowerCase()] || '#ff7875';
      };

      // 渲染边界框
      const renderBoundingBoxes = () => {
            if (!selectedImage || !processedResults || processedResults.length === 0) {
                  return null;
            }

            return processedResults.map((defect, index) => {
                  if (defect.bbox) {
                        const { x1, y1, x2, y2 } = defect.bbox;
                        const width = x2 - x1;
                        const height = y2 - y1;

                        return (
                              <div
                                    key={index}
                                    style={{
                                          position: 'absolute',
                                          left: `${x1}px`,
                                          top: `${y1}px`,
                                          width: `${width}px`,
                                          height: `${height}px`,
                                          border: `2px solid ${getDefectColor(defect.type)}`,
                                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                          pointerEvents: 'none',
                                          zIndex: 100,
                                    }}
                              >
                                    <div style={{
                                          position: 'absolute',
                                          top: '-20px',
                                          left: '0',
                                          background: getDefectColor(defect.type),
                                          color: 'white',
                                          padding: '0 4px',
                                          fontSize: '10px',
                                          whiteSpace: 'nowrap'
                                    }}>
                                          {defect.type} {defect.confidence ? `(${defect.confidence}%)` : ''}
                                    </div>
                              </div>
                        );
                  }
                  return null;
            });
      };

      // 获取图表配置
      const getChartOption = () => {
            const defectTypes = detectionResults?.statistics?.defect_types;
            if (!defectTypes || Object.keys(defectTypes).length === 0) {
                  return {
                        tooltip: { trigger: 'item' },
                        legend: { show: false },
                        series: []
                  };
            }

            const defectNames = Object.keys(defectTypes);
            const colors = defectNames.map(name => getDefectColor(name));

            return {
                  tooltip: {
                        trigger: 'item',
                        formatter: '{a} <br/>{b}: {c} ({d}%)'
                  },
                  legend: {
                        orient: 'horizontal',
                        bottom: 10,
                        left: 'center',
                        data: defectNames
                  },
                  series: [{
                        name: '缺陷类型',
                        type: 'pie',
                        radius: '65%',
                        center: ['50%', '40%'],
                        data: Object.entries(defectTypes).map(([name, value]) => ({
                              value,
                              name
                        })),
                        emphasis: {
                              itemStyle: {
                                    shadowBlur: 10,
                                    shadowOffsetX: 0,
                                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                              }
                        }
                  }]
            };
      };

      return (
            <Layout className="app-container">
                  <Header className="app-header">
                        <div className="logo">PCB缺陷检测系统</div>
                        <div className="header-controls">
                              <Button onClick={handleLogout} icon={<UserOutlined />}>
                                    退出登录
                              </Button>
                        </div>
                  </Header>
                  <Layout className="content-layout">
                        <div className="sidebar">
                              <div className="system-status">
                                    <h3>系统状态</h3>
                                    <Card>
                                          <Statistic title="CPU使用率" value={systemStatus.cpuUsage} suffix="%" />
                                          <Statistic title="内存使用率" value={systemStatus.memoryUsage} suffix="%" />
                                          <Statistic title="运行时间" value={systemStatus.uptime} />
                                    </Card>
                              </div>
                        </div>
                        <Content className="main-content">
                              <div className="image-section">
                                    <div className="image-container" ref={imageWrapperRef}>
                                          {selectedImage ? (
                                                <img
                                                      src={selectedImage}
                                                      alt="Selected PCB"
                                                      style={{
                                                            transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
                                                      }}
                                                />
                                          ) : (
                                                <div className="upload-placeholder">
                                                      <Upload.Dragger
                                                            accept="image/*"
                                                            beforeUpload={handleImageUpload}
                                                            showUploadList={false}
                                                      >
                                                            <p className="ant-upload-drag-icon">
                                                                  <UploadOutlined />
                                                            </p>
                                                            <p className="ant-upload-text">点击或拖拽图片到此区域</p>
                                                      </Upload.Dragger>
                                                </div>
                                          )}
                                          {renderBoundingBoxes()}
                                    </div>
                              </div>
                              <div className="results-section">
                                    <h3>检测结果</h3>
                                    <div className="results-content">
                                          {loading ? (
                                                <div className="loading-indicator">
                                                      <Spin size="large" />
                                                      <p>正在处理中...</p>
                                                </div>
                                          ) : (
                                                detectionResults.defects.length > 0 && (
                                                      <div className="results-stats">
                                                            <ReactECharts option={getChartOption()} style={{ height: '300px' }} />
                                                      </div>
                                                )
                                          )}
                                    </div>
                              </div>
                              <div className="model-section">
                                    <h3>模型设置</h3>
                                    <div className="model-settings">
                                          <div className="setting-item">
                                                <label>模型选择:</label>
                                                <Select
                                                      value={selectedModel}
                                                      onChange={setSelectedModel}
                                                      style={{ width: 200 }}
                                                >
                                                      <Select.Option value="yolov11">YOLOv11</Select.Option>
                                                      <Select.Option value="yolov11-vote2">YOLOv11 (2-Vote)</Select.Option>
                                                      <Select.Option value="yolov11-vote4">YOLOv11 (4-Vote)</Select.Option>
                                                </Select>
                                          </div>
                                          <div className="setting-item">
                                                <label>IOU阈值:</label>
                                                <Slider
                                                      min={0}
                                                      max={1}
                                                      step={0.01}
                                                      value={iouThreshold}
                                                      onChange={setIouThreshold}
                                                      style={{ width: 200 }}
                                                />
                                          </div>
                                          <div className="setting-item">
                                                <label>置信度阈值:</label>
                                                <Slider
                                                      min={0}
                                                      max={1}
                                                      step={0.01}
                                                      value={confThreshold}
                                                      onChange={setConfThreshold}
                                                      style={{ width: 200 }}
                                                />
                                          </div>
                                    </div>
                                    <div className="action-buttons">
                                          <Button
                                                type="primary"
                                                onClick={handleBatchDetection}
                                                loading={loading}
                                                icon={<SearchOutlined />}
                                          >
                                                开始检测
                                          </Button>
                                    </div>
                              </div>
                        </Content>
                  </Layout>
            </Layout>
      );
}

export default Dashboard; 