import React, { useState, useEffect, useRef } from 'react';
import { Layout, Button, Card, Statistic, Progress, Tabs, Upload, message, Select, Slider, Pagination, InputNumber, Spin, Tooltip } from 'antd';
import { CameraOutlined, VideoCameraOutlined, UploadOutlined, ZoomInOutlined, ZoomOutOutlined, SettingOutlined, BulbOutlined, UserOutlined, SearchOutlined, FolderOutlined, LeftOutlined, RightOutlined, LoadingOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
// 在文件顶部添加图标导入
import { PlayCircleOutlined, PauseCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import './App.css';
import Login from './components/Login';

// 添加API基础URL配置
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// 配置axios默认值
axios.defaults.baseURL = API_BASE_URL;

// 添加一个函数来更新API基础URL
const updateApiBaseUrl = (ip) => {
      const newBaseUrl = `http://${ip}:5000`;
      console.log(`更新API基础URL为: ${newBaseUrl}`);
      axios.defaults.baseURL = newBaseUrl;
};

const { Header, Sider, Content } = Layout;
const { TabPane } = Tabs;

function App() {
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
      const [isPaused, setIsPaused] = useState(false); // 是否暂停检测
      // 添加缺陷过滤相关的状态变量
      const [defectFilter, setDefectFilter] = useState('all');
      const [processedResults, setProcessedResults] = useState([]);
      const [defectTypes, setDefectTypes] = useState(['all', 'mouse_bite', 'open_circuit', 'short', 'spur', 'spurious_copper']);
      const isPausedRef = useRef(false);

      // 添加到其他state变量之后
      const [isCameraActive, setIsCameraActive] = useState(false);
      const [videoStream, setVideoStream] = useState(null);
      const videoRef = useRef(null);
      const [isCapturing, setIsCapturing] = useState(false);
      const [captureInterval, setCaptureInterval] = useState(null);

      const [currentRunTime, setCurrentRunTime] = useState('0秒');
      const [runTimeInterval, setRunTimeInterval] = useState(null);

      const prevOverflowStyle = useRef('');
      // 添加一个防抖函数，确保同一时间只处理一次上传请求
      const debounce = (func, delay) => {
            let debounceTimer;
            return function (...args) {
                  const context = this;
                  clearTimeout(debounceTimer);
                  debounceTimer = setTimeout(() => func.apply(context, args), delay);
            };
      };

      // 添加缺陷列表的ref
      const defectsListRef = useRef(null);
      // 添加一个标志控制缺陷列表是否可以滚动
      const [defectsListHover, setDefectsListHover] = useState(false);

      const [isLoggedIn, setIsLoggedIn] = useState(false);
      const [currentUser, setCurrentUser] = useState(null);
      // 添加图像尺寸状态
      const [imageDimensions, setImageDimensions] = useState(null);

      // Add this with the other refs near the top of the component
      const startTimeRef = useRef(null);

      useEffect(() => {
            const fetchSystemStatus = async () => {
                  try {
                        const response = await axios.get('/api/system-status');
                        setSystemStatus({
                              status: response.data.status,
                              cpuUsage: response.data.cpu_usage,
                              memoryUsage: response.data.memory_usage,
                              uptime: response.data.uptime
                        });

                        // 如果后端返回了服务器IP地址，并且不是localhost，则更新API基础URL
                        if (response.data.server_ip && response.data.server_ip !== '127.0.0.1') {
                              updateApiBaseUrl(response.data.server_ip);
                        }
                  } catch (error) {
                        console.error('Error fetching system status:', error);
                        message.error('系统状态更新失败');
                  }
            };

            fetchSystemStatus();
            const statusInterval = setInterval(fetchSystemStatus, 5000);
            return () => clearInterval(statusInterval);
      }, []);

      useEffect(() => {
            isPausedRef.current = isPaused;
      }, [isPaused]);

      useEffect(() => {
            if (videoRef.current && videoStream) {
                  console.log('videoStream变化，设置视频源...');
                  videoRef.current.srcObject = videoStream;
                  videoRef.current.play()
                        .then(() => console.log('视频播放成功 [useEffect]'))
                        .catch(err => {
                              console.error('视频播放失败 [useEffect]:', err);
                              message.error('视频播放失败: ' + err.message);
                        });
            }
      }, [videoStream]);

      // 添加useEffect清理资源
      useEffect(() => {
            return () => {
                  previewUrls.forEach(url => URL.revokeObjectURL(url));
            };
      }, [previewUrls]);

      // 清理视频和定时器资源
      useEffect(() => {
            return () => {
                  if (runTimeInterval) {
                        clearInterval(runTimeInterval);
                  }
                  if (videoStream) {
                        videoStream.getTracks().forEach(track => track.stop());
                  }
                  if (captureInterval) {
                        clearInterval(captureInterval);
                  }
            };
      }, []);

      useEffect(() => {
            // Check if user is already logged in
            const token = localStorage.getItem('token');
            const user = localStorage.getItem('user');
            if (token && user) {
                  setIsLoggedIn(true);
                  setCurrentUser(JSON.parse(user));
            }
      }, []);

      // 打开摄像头
      const handleOpenCamera = async () => {
            try {
                  console.log('开始打开/关闭摄像头操作, 当前状态:', { isCameraActive });

                  if (isCameraActive) {
                        // 关闭摄像头逻辑
                        console.log('正在关闭摄像头...');
                        if (videoStream) {
                              videoStream.getTracks().forEach(track => track.stop());
                        }
                        setVideoStream(null);
                        setIsCameraActive(false);

                        // 停止实时检测
                        if (isCapturing) {
                              setIsCapturing(false);
                              if (captureInterval) {
                                    clearInterval(captureInterval);
                                    setCaptureInterval(null);
                              }
                        }

                        // 重置检测进度
                        setDetectionProgress(0);

                        // 重置所有图像相关状态
                        setImageList([]);
                        setPreviewUrls([]);
                        setSelectedImage(null);
                        setCurrentImageIndex(0);
                        setDetectionHistory([]);
                        setDetectionResults({
                              defects: [],
                              statistics: {
                                    defect_types: {}
                              }
                        });
                        setProcessedResults([]);
                        setImageDimensions(null);
                        setScale(1);
                        setPosition({ x: 0, y: 0 });

                        message.success('摄像头已关闭');
                        return;
                  }

                  // 先重置图像状态，确保界面干净
                  resetImageAndDetectionStates();

                  // 检查浏览器是否支持摄像头API
                  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        message.error('您的浏览器不支持访问摄像头功能');
                        return;
                  }

                  console.log('正在请求摄像头权限...');
                  // 尝试访问摄像头
                  const stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                              width: { ideal: 1280 },
                              height: { ideal: 720 }
                        }
                  });

                  console.log('成功获取摄像头流');

                  // 重要：先设置状态再处理视频元素
                  setIsCameraActive(true);
                  setVideoStream(stream);

                  // 等待状态更新完成
                  await new Promise(resolve => setTimeout(resolve, 50));

                  // 直接设置视频源
                  if (videoRef.current) {
                        console.log('设置视频元素源...');
                        videoRef.current.srcObject = stream;
                        try {
                              await videoRef.current.play();
                              console.log('视频播放成功');
                        } catch (err) {
                              console.error('视频播放失败:', err);
                        }
                  }

                  message.success('摄像头已打开');
            } catch (error) {
                  console.error('无法访问摄像头:', error);

                  // 更详细的错误信息处理
                  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                        message.error('摄像头访问被拒绝，请在浏览器中允许访问摄像头');
                  } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                        message.error('未找到摄像头设备，请确保您的设备已连接摄像头');
                  } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                        message.error('无法读取摄像头，可能被其他应用程序占用');
                  } else {
                        message.error('无法访问摄像头: ' + error.message);
                  }
            }
      };


      const resetImageAndDetectionStates = () => {
            console.log('重置图像和检测状态开始');

            // 清理URL资源
            previewUrls.forEach(url => {
                  try {
                        URL.revokeObjectURL(url);
                  } catch (e) {
                        console.error("撤销URL时出错:", e);
                  }
            });

            // 重置图像和检测相关状态，但保留摄像头状态
            setImageList([]);
            setPreviewUrls([]);
            setSelectedImage(null);
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
            setScale(1);
            setPosition({ x: 0, y: 0 });
            // 重置图像尺寸
            setImageDimensions(null);

            console.log('重置图像和检测状态完成');
      };

      // 捕获视频帧并转换为文件
      const captureVideoFrame = () => {
            if (!videoRef.current || !isCameraActive) {
                  console.error('视频元素不可用或摄像头未激活');
                  return null;
            }

            // 检查视频是否在播放
            if (videoRef.current.paused || videoRef.current.ended) {
                  console.warn('视频已暂停或结束，尝试重新播放');
                  videoRef.current.play().catch(err => {
                        console.error('无法重新播放视频:', err);
                  });
                  return null;
            }

            // 确保视频尺寸有效
            const videoWidth = videoRef.current.videoWidth;
            const videoHeight = videoRef.current.videoHeight;

            if (!videoWidth || !videoHeight) {
                  console.warn('视频尺寸无效:', videoWidth, videoHeight);
                  return null;
            }

            console.log('捕获视频帧，原始尺寸:', videoWidth, 'x', videoHeight);

            // 计算等比例缩放后的尺寸
            let newWidth, newHeight;

            if (videoWidth > 600 || videoHeight > 600) {
                  // 固定宽度为600, 高度按比例缩放
                  newWidth = 600;
                  newHeight = Math.round((videoHeight / videoWidth) * 600);
            } else {
                  // 小尺寸视频保持原始尺寸
                  newWidth = videoWidth;
                  newHeight = videoHeight;
            }

            console.log('捕获视频帧，缩放后尺寸:', newWidth, 'x', newHeight);

            // 创建两个画布 - 一个用于捕获原始帧，一个用于缩放
            const captureCanvas = document.createElement('canvas');
            captureCanvas.width = videoWidth;
            captureCanvas.height = videoHeight;

            // 先在原始尺寸画布上绘制视频帧
            const captureCtx = captureCanvas.getContext('2d');
            captureCtx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);

            // 创建第二个画布用于缩放
            const scaleCanvas = document.createElement('canvas');
            scaleCanvas.width = newWidth;
            scaleCanvas.height = newHeight;

            // 在第二个画布上绘制缩放后的图像
            const scaleCtx = scaleCanvas.getContext('2d');
            scaleCtx.drawImage(captureCanvas, 0, 0, videoWidth, videoHeight, 0, 0, newWidth, newHeight);

            // 保存缩放后的尺寸信息到state
            setImageDimensions({ width: newWidth, height: newHeight });

            // 将缩放后的画布转换为Blob
            return new Promise((resolve) => {
                  scaleCanvas.toBlob((blob) => {
                        if (!blob) {
                              console.error('无法创建Blob');
                              resolve(null);
                              return;
                        }

                        // 创建File对象
                        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
                        resolve(file);
                  }, 'image/jpeg', 0.95); // 高质量JPEG
            });
      };
      // 开始或暂停实时检测
      // 开始或暂停实时检测
      const toggleContinuousCapture = async () => {
            // Reset runtime variables at the start of continuous capture
            setStartTime(null);
            startTimeRef.current = null;
            setEndTime(null);
            setCurrentRunTime('0秒');
            if (isCapturing) {
                  // 如果正在捕获，则停止
                  if (captureInterval) {
                        clearInterval(captureInterval);
                        setCaptureInterval(null);
                  }

                  // 停止运行时长计时
                  if (runTimeInterval) {
                        clearInterval(runTimeInterval);
                        setRunTimeInterval(null);
                  }

                  // 设置结束时间
                  if (startTimeRef.current) {
                        const end = Date.now();
                        setEndTime(end);

                        // 计算最终运行时长
                        const finalDuration = Math.floor((end - startTimeRef.current) / 1000);
                        const hours = Math.floor(finalDuration / 3600);
                        const minutes = Math.floor((finalDuration % 3600) / 60);
                        const seconds = finalDuration % 60;
                        setCurrentRunTime(`${hours}小时${minutes}分钟${seconds}秒`);
                  }

                  setIsCapturing(false);

                  // 重置检测结果以清除边界框，但确保不影响视频流
                  setDetectionResults({
                        defects: [],
                        statistics: {
                              defect_types: {}
                        }
                  });

                  message.info('已停止实时检测');
                  return;
            }

            // 开始实时捕获
            if (!isCameraActive) {
                  message.warning('请先打开摄像头');
                  return;
            }

            // 确保视频元素存在且正在播放
            if (!videoRef.current || !videoRef.current.srcObject) {
                  console.error('视频元素未准备就绪');
                  message.error('视频未准备就绪，请重新打开摄像头');
                  return;
            }

            // 检查视频流是否可用
            try {
                  if (videoRef.current.paused || videoRef.current.ended) {
                        await videoRef.current.play();
                        console.log('重新开始播放视频');
                  }
            } catch (err) {
                  console.error('无法播放视频:', err);
                  message.error('无法播放视频');
                  return;
            }

            // 设置开始时间
            const start = Date.now();
            setStartTime(start);
            startTimeRef.current = start;
            setEndTime(null);

            // 启动运行时长计时器
            const timeInterval = setInterval(() => {
                  const now = Date.now();
                  // Use the ref instead of the closure value
                  const duration = Math.floor((now - startTimeRef.current) / 1000); // 秒数
                  const hours = Math.floor(duration / 3600);
                  const minutes = Math.floor((duration % 3600) / 60);
                  const seconds = duration % 60;
                  setCurrentRunTime(`${hours}小时${minutes}分钟${seconds}秒`);
            }, 1000);

            setRunTimeInterval(timeInterval);

            setIsCapturing(true);
            message.info('开始实时检测');
            console.log('开始实时检测，视频流状态:', videoRef.current.readyState);

            // 设置定期捕获和检测
            const interval = setInterval(async () => {
                  try {
                        // 检查视频状态，确保检测过程中摄像头未关闭
                        if (!videoRef.current || !videoRef.current.srcObject || !isCameraActive) {
                              console.warn('视频元素不存在或摄像头已关闭，停止检测');
                              clearInterval(interval);

                              // 停止运行时长计时
                              if (runTimeInterval) {
                                    clearInterval(runTimeInterval);
                                    setRunTimeInterval(null);
                              }

                              setIsCapturing(false);
                              setCaptureInterval(null);
                              message.warning('摄像头已断开，实时检测停止');
                              return;
                        }

                        // 如果视频暂停，尝试重新播放
                        if (videoRef.current.paused || videoRef.current.ended) {
                              console.warn('视频暂停或结束，尝试重新播放');
                              try {
                                    await videoRef.current.play();
                              } catch (playErr) {
                                    console.error('无法重新播放视频:', playErr);
                                    message.error('无法恢复视频播放，实时检测停止');
                                    clearInterval(interval);

                                    // 停止运行时长计时
                                    if (runTimeInterval) {
                                          clearInterval(runTimeInterval);
                                          setRunTimeInterval(null);
                                    }

                                    setIsCapturing(false);
                                    setCaptureInterval(null);
                                    return;
                              }
                        }

                        // 捕获视频帧
                        const capturedFrame = await captureVideoFrame();
                        if (capturedFrame) {
                              console.log('成功捕获视频帧', new Date().toLocaleTimeString());
                              setDetectionProgress(20);

                              // 处理捕获的帧并检测缺陷
                              const result = await processImage(capturedFrame);
                              console.log('检测结果:', result.defects.length > 0 ? `发现${result.defects.length}个缺陷` : '未发现缺陷');

                              // 确保在摄像头活动且视频元素存在时更新结果
                              if (isCameraActive && videoRef.current) {
                                    // 确认视频仍在播放
                                    if (videoRef.current.paused) {
                                          console.log('检测期间视频暂停，尝试恢复');
                                          videoRef.current.play().catch(e => console.error('无法恢复视频:', e));
                                    }

                                    // 更新检测结果之前先清除之前的结果
                                    setProcessedResults([]);

                                    // 更新检测结果
                                    setDetectionResults(result);
                              }

                              setDetectionProgress(100);
                        } else {
                              console.warn('未能捕获视频帧');
                        }
                  } catch (error) {
                        console.error('实时检测错误:', error);
                        message.error('实时检测出错: ' + error.message);
                  }
            }, 2000); // 每2秒捕获一次

            setCaptureInterval(interval);
      };
      // 处理缺陷过滤的变化
      const handleDefectFilterChange = (value) => {
            setDefectFilter(value);
            filterDefects(value);
      };
      const resetAllStates = () => {
            console.log('重置所有状态开始，摄像头状态:', isCameraActive);
            if (runTimeInterval) {
                  clearInterval(runTimeInterval);
                  setRunTimeInterval(null);
            }

            // 重置运行时长
            setCurrentRunTime('0秒');
            setStartTime(null);
            startTimeRef.current = null;
            setEndTime(null);

            // 如果摄像头处于活动状态，只重置图像相关状态
            if (isCameraActive) {
                  resetImageAndDetectionStates();
                  return;
            }

            // 否则重置所有状态包括摄像头
            // 清理URL资源
            previewUrls.forEach(url => {
                  try {
                        URL.revokeObjectURL(url);
                  } catch (e) {
                        console.error("撤销URL时出错:", e);
                  }
            });

            // 清理摄像头资源
            if (videoStream) {
                  videoStream.getTracks().forEach(track => track.stop());
            }
            setVideoStream(null);
            setIsCameraActive(false);

            if (captureInterval) {
                  clearInterval(captureInterval);
                  setCaptureInterval(null);
            }

            // 重置其他状态
            setImageList([]);
            setPreviewUrls([]);
            setSelectedImage(null);
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
            setScale(1);
            setPosition({ x: 0, y: 0 });

            console.log('重置所有状态完成');
      };
      // 过滤缺陷基于选择
      const filterDefects = (filterType) => {
            if (!detectionResults || !detectionResults.defects) return;

            if (filterType === 'all') {
                  setProcessedResults(detectionResults.defects);
            } else {
                  const filtered = detectionResults.defects.filter(defect =>
                        defect.type.toLowerCase() === filterType.toLowerCase()
                  );
                  setProcessedResults(filtered);
            }
      };

      // 当检测结果改变时更新处理后的结果
      useEffect(() => {
            if (detectionResults && detectionResults.defects) {
                  // 根据实际结果更新缺陷类型
                  const types = ['all'];
                  detectionResults.defects.forEach(defect => {
                        if (!types.includes(defect.type.toLowerCase())) {
                              types.push(defect.type.toLowerCase());
                        }
                  });
                  setDefectTypes(types);

                  // 应用当前过滤器
                  filterDefects(defectFilter);
            }
      }, [detectionResults]);

      // 获取每种缺陷类型的颜色
      const getDefectColor = (defectType) => {
            const colorMap = {
                  'mouse_bite': '#ff7875',      // 适中红色
                  'open_circuit': '#40a9ff',     // 适中蓝色
                  'short': '#ffc53d',           // 适中黄色
                  'spur': '#73d13d',           // 适中绿色
                  'spurious_copper': '#9254de'  // 适中紫色
            };

            return colorMap[defectType.toLowerCase()] || '#ff7875'; // 默认使用适中红色
      };

      // 渲染边界框
      const renderBoundingBoxes = () => {
            // 修改条件判断，针对摄像头模式添加特殊处理
            if ((!selectedImage && !isCameraActive) || !processedResults || processedResults.length === 0) {
                  return null;
            }

            // 获取视频元素的实际位置和尺寸
            let videoPosition = { left: 0, top: 0, width: 0, height: 0 };
            let scaleFactor = 1;

            if (isCameraActive && videoRef.current && imageDimensions) {
                  // 获取视频元素的计算样式和几何信息
                  const videoElement = videoRef.current;
                  const videoComputedStyle = window.getComputedStyle(videoElement);
                  const videoRect = videoElement.getBoundingClientRect();
                  const parentRect = videoElement.parentElement.getBoundingClientRect();

                  // 计算视频相对于父容器的位置（由于objectFit: contain会留白）
                  // 视频元素的位置会因为居中显示而有偏移
                  videoPosition = {
                        width: videoRect.width,
                        height: videoRect.height,
                        // 计算相对于父容器的左偏移
                        left: videoRect.left - parentRect.left,
                        // 计算相对于父容器的顶部偏移
                        top: videoRect.top - parentRect.top
                  };

                  // 视频显示尺寸与原始图像尺寸比例
                  const scaleX = videoPosition.width / imageDimensions.width;
                  const scaleY = videoPosition.height / imageDimensions.height;
                  scaleFactor = Math.min(scaleX, scaleY);

                  console.log('视频位置计算:', {
                        videoPosition,
                        imageSize: imageDimensions,
                        scale: scaleFactor,
                        boxOffset: { x: videoPosition.left, y: videoPosition.top }
                  });
            }

            return processedResults.map((defect, index) => {
                  // 检查是否有实际的边界框数据
                  if (defect.bbox) {
                        let { x1, y1, x2, y2 } = defect.bbox;

                        // 应用视频帧中的缩放因子和偏移
                        if (isCameraActive && imageDimensions) {
                              // 基于imageWrapperRef计算视频内容的实际显示区域
                              let scale = 1;
                              let offsetX = 0;
                              let offsetY = 0;
                              if (isCameraActive && imageDimensions && imageWrapperRef.current) {
                                    const wrapperRect = imageWrapperRef.current.getBoundingClientRect();
                                    const containerW = wrapperRect.width;
                                    const containerH = wrapperRect.height;
                                    const { width: imgW, height: imgH } = imageDimensions;
                                    const imgRatio = imgW / imgH;
                                    const containerRatio = containerW / containerH;
                                    let contentW, contentH;
                                    if (imgRatio > containerRatio) {
                                          contentW = containerW;
                                          contentH = contentW / imgRatio;
                                    } else {
                                          contentH = containerH;
                                          contentW = contentH * imgRatio;
                                    }
                                    // 计算内容区域的偏移量（居中留白）
                                    offsetX = (containerW - contentW) / 2;
                                    offsetY = (containerH - contentH) / 2;
                                    // 计算缩放比例
                                    scale = contentW / imgW;
                              }
                              x1 = x1 * scale + offsetX;
                              y1 = y1 * scale + offsetY;
                              x2 = x2 * scale + offsetX;
                              y2 = y2 * scale + offsetY;
                        }

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
                  } else if (defect.position) {
                        // 使用位置数据的后备选项
                        const boxWidth = 60;
                        const boxHeight = 40;
                        let x = defect.position.x - (boxWidth / 2);
                        let y = defect.position.y - (boxHeight / 2);

                        // 应用视频帧中的缩放因子和偏移
                        if (isCameraActive && imageDimensions) {
                              x = x * scaleFactor + videoPosition.left;
                              y = y * scaleFactor + videoPosition.top;
                        }

                        return (
                              <div
                                    key={index}
                                    style={{
                                          position: 'absolute',
                                          left: `${x}px`,
                                          top: `${y}px`,
                                          width: `${boxWidth}px`,
                                          height: `${boxHeight}px`,
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


      // 处理单个图片上传
      const handleImageUpload = (file) => {
            if (!file) {
                  return false;
            }

            setIsUploading(true);

            // 使用Image API预加载图片并计算尺寸
            const img = new Image();
            img.onload = () => {
                  // 计算等比例缩放后的尺寸
                  let newWidth, newHeight;

                  if (img.width > 600 || img.height > 600) {
                        // 固定宽度为600, 高度按比例缩放
                        newWidth = 600;
                        newHeight = Math.round((img.height / img.width) * 600);
                  } else {
                        // 小图维持原尺寸
                        newWidth = img.width;
                        newHeight = img.height;
                  }

                  // 创建canvas进行缩放
                  const canvas = document.createElement('canvas');
                  canvas.width = newWidth;
                  canvas.height = newHeight;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0, newWidth, newHeight);

                  // 转换为blob并上传
                  canvas.toBlob(async (blob) => {
                        try {
                              // 将缩放后的图像尺寸保存到状态中
                              setImageDimensions({ width: newWidth, height: newHeight });

                              // 创建新的File对象并处理
                              const resizedFile = new File([blob], file.name, { type: file.type });

                              // 在UI上显示缩放后的图
                              const imageUrl = URL.createObjectURL(blob);

                              // 更新状态
                              setImageList([resizedFile]);
                              setPreviewUrls([imageUrl]);
                              setSelectedImage(imageUrl);
                              setCurrentImageIndex(0);

                              // 重置检测历史
                              setDetectionHistory([]);

                              // 重置检测结果
                              setDetectionResults({
                                    defects: [],
                                    statistics: {
                                          defect_types: {}
                                    }
                              });

                              // 重置处理后的结果
                              setProcessedResults([]);

                              setDetectionProgress(0);
                              setBatchProgress(0);
                              message.success('图片导入成功');
                        } catch (error) {
                              console.error('图片处理错误:', error);
                              message.error('图片处理失败');
                        } finally {
                              setIsUploading(false);
                        }
                  }, file.type, 0.95); // 高质量
            };

            img.onerror = () => {
                  console.error('图片加载失败');
                  message.error('图片加载失败');
                  setIsUploading(false);
            };

            img.src = URL.createObjectURL(file);
            return false; // 阻止默认上传行为
      };

      // 处理文件夹上传的防抖版本
      // 处理文件夹上传的防抖版本
      const debouncedHandleFolderUpload = debounce((info) => {
            console.log("文件夹上传信息 (防抖处理):", info);
            setIsUploading(true);

            try {
                  // 先重置所有状态，确保干净的开始
                  resetAllStates();

                  // 确保文件列表存在且不为空
                  if (!info || !info.fileList || info.fileList.length === 0) {
                        message.warning('未找到文件');
                        setIsUploading(false);
                        return;
                  }

                  // 处理新文件
                  const newFiles = [];
                  info.fileList.forEach(file => {
                        const fileObj = file.originFileObj || file;
                        if (fileObj && fileObj.type && fileObj.type.startsWith('image/')) {
                              newFiles.push(fileObj);
                        }
                  });

                  console.log("导入的图片文件数量:", newFiles.length);

                  if (newFiles.length === 0) {
                        message.warning('未找到图片文件');
                        setIsUploading(false);
                        return;
                  }

                  // 创建新URL
                  const urls = [];
                  for (const file of newFiles) {
                        try {
                              const url = URL.createObjectURL(file);
                              urls.push(url);
                        } catch (e) {
                              console.error("无法为文件创建URL:", file.name, e);
                        }
                  }

                  if (urls.length === 0) {
                        message.error('无法处理图片文件');
                        setIsUploading(false);
                        return;
                  }

                  // 设置新的状态
                  setImageList(newFiles);
                  setPreviewUrls(urls);
                  setSelectedImage(urls[0]);

                  message.success(`成功导入 ${newFiles.length} 张图片`);
            } catch (error) {
                  console.error('文件夹导入错误:', error);
                  message.error('文件夹导入失败');
                  // 出错时也重置状态
                  resetAllStates();
            } finally {
                  setIsUploading(false);
            }
      }, 300); // 300ms的防抖延迟

      // 重置图片位置（在切换图片时调用）
      const resetImagePosition = () => {
            setScale(1);
            setPosition({ x: 0, y: 0 });
      };

      // 处理图片切换
      const handleImageChange = (index) => {
            if (index >= 0 && index < imageList.length) {
                  setCurrentImageIndex(index);
                  setSelectedImage(previewUrls[index]);
                  resetImagePosition(); // 重置缩放和位置
                  // 如果有检测结果，显示对应结果
                  if (detectionHistory[index]) {
                        setDetectionResults(detectionHistory[index].result);
                  }
            }
      };

      // 处理上一张图片
      const handlePrevImage = () => {
            handleImageChange(currentImageIndex - 1);
      };

      // 处理下一张图片
      const handleNextImage = () => {
            handleImageChange(currentImageIndex + 1);
      };

      // 处理页码变化
      const handlePageChange = (page) => {
            handleImageChange(page - 1);
      };

      const [selectedModel, setSelectedModel] = useState('yolov11'); // 默认选择Yolov11模型

      const handleModelChange = (value) => {
            setSelectedModel(value);
            switch (value) {
                  case 'yolov11':
                        message.info('切换到 Yolov11 模型');
                        break;
                  case 'yolov11-vote2':
                        message.info('切换到 Yolov11-vote2 模型');
                        break;
                  case 'yolov11-vote4':
                        message.info('切换到 Yolov11-vote4 模型');
                        break;
                  default:
                        message.warning('未知模型选择');
            }
      };

      const [iouThreshold, setIouThreshold] = useState(0.45); // 默认值为 0.45
      const [confThreshold, setConfThreshold] = useState(0.4); // 默认值为 0.4

      // 修改单个图片检测逻辑，传递 iou_threshold 和 conf_threshold 参数
      const processImage = async (file) => {
            try {
                  const formData = new FormData();
                  formData.append('image', file);

                  // 添加图像尺寸信息到请求参数中
                  const params = {
                        vote_threshold: selectedModel === 'yolov11-vote2' ? 1 : selectedModel === 'yolov11-vote4' ? 2 : 1,
                        orientation_count: selectedModel === 'yolov11-vote2' ? 2 : selectedModel === 'yolov11-vote4' ? 4 : 1,
                        iou_threshold: iouThreshold,
                        conf_threshold: confThreshold,
                  };

                  // 如果有图像尺寸信息，也传递给后端
                  if (imageDimensions) {
                        params.img_width = imageDimensions.width;
                        params.img_height = imageDimensions.height;
                  }

                  const detectResponse = await axios.post('/api/detect', formData, {
                        params: params,
                  });

                  return detectResponse.data;
            } catch (error) {
                  throw new Error(`检测失败: ${error.message}`);
            }
      };

      // 批量检测处理
      const [startTime, setStartTime] = useState(null); // 检测开始时间
      const [endTime, setEndTime] = useState(null); // 检测结束时间

      // 计算运行时长
      const calculateUptime = () => {
            if (!startTime || !endTime) return 'N/A';
            const duration = Math.floor((endTime - startTime) / 1000); // 秒数
            const hours = Math.floor(duration / 3600);
            const minutes = Math.floor((duration % 3600) / 60);
            const seconds = duration % 60;
            return `${hours}小时${minutes}分钟${seconds}秒`;
      };

      // 修改 handleBatchDetection 函数，记录开始和结束时间
      const handleBatchDetection = async () => {
            // Reset runtime variables at the start of batch detection
            setStartTime(null);
            startTimeRef.current = null;
            setEndTime(null);
            setCurrentRunTime('0秒');
            if (isCameraActive) {
                  toggleContinuousCapture();
                  return;
            }
            if (imageList.length === 0) {
                  message.warning('请先导入图片');
                  return;
            }

            if (isBatchProcessing) {
                  const newPauseState = !isPaused;
                  setIsPaused(newPauseState);
                  isPausedRef.current = newPauseState;
                  message.info(newPauseState ? '暂停检测' : '继续检测');
                  return;
            }

            setIsBatchProcessing(true);
            setLoading(true);
            setIsPaused(false);
            isPausedRef.current = false;

            // 记录检测开始时间
            const start = Date.now();
            setStartTime(start);
            startTimeRef.current = start;
            setEndTime(null);

            // 启动运行时长计时器
            const interval = setInterval(() => {
                  const now = Date.now();
                  // Use the ref instead of the closure value
                  const duration = Math.floor((now - startTimeRef.current) / 1000); // 秒数
                  const hours = Math.floor(duration / 3600);
                  const minutes = Math.floor((duration % 3600) / 60);
                  const seconds = duration % 60;
                  setCurrentRunTime(`${hours}小时${minutes}分钟${seconds}秒`);
            }, 1000);

            setRunTimeInterval(interval);

            let history = [];
            let i = 0;

            try {
                  setDetectionProgress(1);

                  while (i < imageList.length) {
                        if (isPausedRef.current) {
                              await new Promise(resolve => {
                                    const checkPauseInterval = setInterval(() => {
                                          if (!isPausedRef.current) {
                                                clearInterval(checkPauseInterval);
                                                resolve();
                                          }
                                    }, 100);
                              });
                              continue;
                        }

                        setDetectionResults({
                              defects: [],
                              statistics: {
                                    defect_types: {}
                              }
                        });

                        setProcessedResults([]);
                        setCurrentImageIndex(i);
                        setSelectedImage(previewUrls[i]);

                        const progress = Math.round(((i + 1) / imageList.length) * 100);
                        setBatchProgress(progress);
                        setDetectionProgress(progress);

                        const result = await processImage(imageList[i]);

                        history.push({
                              imageUrl: previewUrls[i],
                              result: result
                        });

                        setDetectionResults(result);

                        await new Promise(resolve => setTimeout(resolve, 1000));

                        if (!isPausedRef.current) {
                              i++;
                        }
                  }

                  setDetectionHistory(history);

                  // 停止计时器并记录结束时间
                  clearInterval(runTimeInterval);
                  setRunTimeInterval(null);
                  const end = Date.now();
                  setEndTime(end);

                  // 计算并设置最终运行时长
                  const finalDuration = Math.floor((end - startTimeRef.current) / 1000);
                  const hours = Math.floor(finalDuration / 3600);
                  const minutes = Math.floor((finalDuration % 3600) / 60);
                  const seconds = finalDuration % 60;
                  setCurrentRunTime(`${hours}小时${minutes}分钟${seconds}秒`);

                  message.success('检测完成');
                  setIsBatchProcessing(false);
            } catch (error) {
                  // 停止计时器
                  clearInterval(runTimeInterval);
                  setRunTimeInterval(null);

                  message.error(error.message);
                  setIsBatchProcessing(false);
            } finally {
                  setLoading(false);
            }
      };
      // 修改useEffect中的全局滚轮事件处理
      useEffect(() => {
            if (selectedImage) {
                  // 我们只需要为图片区域添加滚轮处理，不影响全局滚动
                  const handleImageScrolling = (e) => {
                        // 检查事件是否发生在图片容器内
                        let targetElement = e.target;
                        let isInsideImageWrapper = false;

                        while (targetElement) {
                              if (targetElement === imageWrapperRef.current) {
                                    isInsideImageWrapper = true;
                                    break;
                              }
                              targetElement = targetElement.parentElement;
                        }

                        // 仅当在图片区域内才阻止默认行为
                        if (isInsideImageWrapper) {
                              e.preventDefault();
                        }
                  };

                  // 添加事件监听器到图片容器
                  if (imageWrapperRef.current) {
                        imageWrapperRef.current.addEventListener('wheel', handleImageScrolling, { passive: false });
                  }

                  return () => {
                        // 移除事件监听器
                        if (imageWrapperRef.current) {
                              imageWrapperRef.current.removeEventListener('wheel', handleImageScrolling);
                        }
                  };
            }
      }, [selectedImage]);

      // 移除之前的全局滚轮事件监听代码，改为下面的代码
      // 这个处理只针对图片容器，允许其他区域正常滚动
      useEffect(() => {
            // 清理之前的样式
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
      }, []);

      // 修改handleWheel函数，只处理图片缩放，不影响其他区域的滚动
      const handleWheel = (e) => {
            // 获取图片元素
            const img = imageWrapperRef.current?.querySelector('img');
            if (!img) return;

            // 阻止默认行为，这样图片容器的滚轮操作不会引起页面滚动
            e.preventDefault();

            // 减小缩放系数，使缩放更平滑
            const delta = e.deltaY * -0.005;
            const newScale = Math.min(Math.max(scale + delta, MIN_ZOOM), MAX_ZOOM);

            if (newScale === scale) return;

            // 获取鼠标在图片容器中的相对位置
            const rect = imageWrapperRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // 计算鼠标位置相对于图片中心的偏移
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // 计算新的位置
            const scaleChange = newScale - scale;
            let newPosition = position;

            if (delta > 0) { // 放大时
                  // 以鼠标位置为中心进行放大
                  newPosition = {
                        x: position.x - (mouseX - centerX) * (scaleChange / scale),
                        y: position.y - (mouseY - centerY) * (scaleChange / scale)
                  };
            } else { // 缩小时
                  // 以图片中心为基准点进行缩小
                  newPosition = {
                        x: position.x * (newScale / scale),
                        y: position.y * (newScale / scale)
                  };
            }

            // 更新状态
            setScale(newScale);
            setPosition(newPosition);
      };

      // 处理鼠标拖动
      const handleMouseDown = (e) => {
            if (e.button === 0) {
                  setIsDragging(true);
                  setDragStart({
                        x: e.clientX - position.x,
                        y: e.clientY - position.y
                  });
            }
      };

      const handleMouseMove = (e) => {
            if (isDragging) {
                  const newX = e.clientX - dragStart.x;
                  const newY = e.clientY - dragStart.y;

                  // 限制拖动范围
                  const maxOffset = 300 * (scale - 1);
                  const boundedX = Math.max(Math.min(newX, maxOffset), -maxOffset);
                  const boundedY = Math.max(Math.min(newY, maxOffset), -maxOffset);

                  setPosition({
                        x: boundedX,
                        y: boundedY
                  });
            }
      };

      // 处理鼠标释放事件
      const handleMouseUp = () => {
            setIsDragging(false);
      };

      // 处理鼠标离开事件
      const handleMouseLeave = () => {
            setIsDragging(false);
      };

      // 修改缩放处理函数，添加位置重置
      const handleZoomIn = () => {
            setZoomLevel(prev => {
                  const newZoom = Math.min(prev + ZOOM_STEP, MAX_ZOOM);
                  if (newZoom === 1) {
                        resetImagePosition();
                  }
                  return newZoom;
            });
      };

      const handleZoomOut = () => {
            setZoomLevel(prev => {
                  const newZoom = Math.max(prev - ZOOM_STEP, MIN_ZOOM);
                  if (newZoom === 1) {
                        resetImagePosition();
                  }
                  return newZoom;
            });
      };

      const handleExportResults = async () => {
            if (!detectionResults.defects.length) {
                  message.warning('没有可导出的检测结果');
                  return;
            }

            try {
                  // 检查浏览器是否支持文件系统访问 API
                  if (!window.showDirectoryPicker) {
                        message.error('当前浏览器不支持文件夹选择功能');
                        return;
                  }

                  // 弹出文件夹选择器
                  const directoryHandle = await window.showDirectoryPicker();

                  // 创建子文件夹：标注图片和 JSON 文件
                  const annotatedImagesFolder = await directoryHandle.getDirectoryHandle('Annotated_Images', { create: true });
                  const jsonFolder = await directoryHandle.getDirectoryHandle('JSON_Files', { create: true });

                  // 遍历所有图片，导出标注图片和对应的 JSON 文件
                  for (let i = 0; i < imageList.length; i++) {
                        const imageFile = imageList[i];
                        const imageName = imageFile.name.split('.').slice(0, -1).join('.'); // 去掉文件扩展名

                        // 导出标注图片
                        const annotatedImageName = `${imageName}_annotated.png`;
                        const annotatedImageHandle = await annotatedImagesFolder.getFileHandle(annotatedImageName, { create: true });
                        const writableStream = await annotatedImageHandle.createWritable();

                        // 创建标注图片的 Canvas
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        const image = new Image();

                        // 加载图片并绘制到 Canvas 上
                        image.src = previewUrls[i];
                        await new Promise((resolve) => {
                              image.onload = () => {
                                    canvas.width = image.width;
                                    canvas.height = image.height;
                                    context.drawImage(image, 0, 0);

                                    // 绘制检测框
                                    detectionHistory[i]?.result?.defects.forEach((defect) => {
                                          if (defect.bbox) {
                                                const { x1, y1, x2, y2 } = defect.bbox;
                                                context.strokeStyle = getDefectColor(defect.type);
                                                context.lineWidth = 2;
                                                context.strokeRect(x1, y1, x2 - x1, y2 - y1);

                                                // 绘制缺陷类型标签
                                                context.fillStyle = getDefectColor(defect.type);
                                                context.font = '16px Arial';
                                                context.fillText(defect.type, x1, y1 - 5);
                                          }
                                    });

                                    resolve();
                              };
                        });

                        // 将 Canvas 转换为 Blob 并写入文件
                        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
                        await writableStream.write(blob);
                        await writableStream.close();

                        // 导出对应的 JSON 文件
                        const jsonFileName = `${imageName}_result.json`;
                        const jsonFileHandle = await jsonFolder.getFileHandle(jsonFileName, { create: true });
                        const jsonWritableStream = await jsonFileHandle.createWritable();

                        const jsonResult = {
                              image: imageName,
                              defects: detectionHistory[i]?.result?.defects || [],
                              statistics: detectionHistory[i]?.result?.statistics || {},
                        };

                        await jsonWritableStream.write(JSON.stringify(jsonResult, null, 2));
                        await jsonWritableStream.close();
                  }

                  message.success('检测结果已成功导出');
            } catch (error) {
                  console.error('导出结果失败:', error);
                  message.error('导出结果失败');
            }
      };

      const handleExportReport = () => {
            // 检查是否有检测结果可供导出
            if (!detectionHistory || detectionHistory.length === 0) {
                  message.warning('没有检测结果可供导出');
                  return;
            }

            message.loading('正在生成报告...', 0);

            try {
                  // 创建一个临时的隐藏div来渲染HTML内容
                  const reportContainer = document.createElement('div');
                  reportContainer.style.position = 'absolute';
                  reportContainer.style.left = '-9999px';
                  reportContainer.style.top = '-9999px';
                  reportContainer.style.width = '794px'; // A4宽度 (mm到px的近似值)
                  document.body.appendChild(reportContainer);

                  // 获取当前日期和时间
                  const now = new Date();
                  const dateStr = now.toLocaleDateString('zh-CN');
                  const timeStr = now.toLocaleTimeString('zh-CN');

                  // 计算批次统计数据
                  const batchStatistics = {
                        totalImages: imageList.length,
                        totalDefects: 0,
                        defectTypeCounts: {},
                        imagesWithDefects: 0,
                        averageDefectsPerImage: 0
                  };

                  // 遍历所有检测历史计算统计数据
                  detectionHistory.forEach(history => {
                        if (history.result && history.result.defects) {
                              const defects = history.result.defects;
                              if (defects.length > 0) {
                                    batchStatistics.imagesWithDefects++;
                              }
                              batchStatistics.totalDefects += defects.length;

                              defects.forEach(defect => {
                                    if (!batchStatistics.defectTypeCounts[defect.type]) {
                                          batchStatistics.defectTypeCounts[defect.type] = 0;
                                    }
                                    batchStatistics.defectTypeCounts[defect.type]++;
                              });
                        }
                  });

                  // 计算平均每张图片的缺陷数
                  batchStatistics.averageDefectsPerImage = (batchStatistics.totalDefects / batchStatistics.totalImages).toFixed(2);

                  // 准备批次统计表格
                  let batchStatsRows = '';
                  Object.entries(batchStatistics.defectTypeCounts).forEach(([type, count]) => {
                        const percentage = ((count / batchStatistics.totalDefects) * 100).toFixed(1);
                        batchStatsRows += `
                  <tr>
                        <td>${type}</td>
                        <td>${count}</td>
                        <td>${percentage}%</td>
                  </tr>`;
                  });

                  // 准备当前图片的检测结果表格
                  let currentImageDefectsRows = '';
                  if (detectionResults && detectionResults.defects) {
                        detectionResults.defects.forEach((defect, index) => {
                              const positionStr = defect.bbox ?
                                    `(${defect.bbox.x1.toFixed(0)},${defect.bbox.y1.toFixed(0)},${defect.bbox.x2.toFixed(0)},${defect.bbox.y2.toFixed(0)})` :
                                    '未知';
                              const confidence = defect.confidence ? `${defect.confidence}%` : '未知';

                              currentImageDefectsRows += `
                  <tr>
                        <td>${index + 1}</td>
                        <td>${defect.type}</td>
                        <td>${positionStr}</td>
                        <td>${confidence}</td>
                  </tr>`;
                        });
                  }

                  // 使用HTML创建报告内容
                  reportContainer.innerHTML = `
                  <div style="font-family: 'Microsoft YaHei', 'SimHei', sans-serif; padding: 20px; color: #333;">
                        <style>
                              table {
                                    width: 100%;
                                    border-collapse: collapse;
                                    margin: 15px 0;
                              }
                              th, td {
                                    border: 1px solid #ddd;
                                    padding: 8px;
                                    text-align: center;
                              }
                              th {
                                    background-color: #00539c;
                                    color: white;
                                    font-weight: bold;
                              }
                              tr:nth-child(even) {
                                    background-color: #f2f2f2;
                              }
                              h1, h2, h3 {
                                    color: #00539c;
                                    margin-bottom: 10px;
                              }
                              .report-header {
                                    text-align: center;
                                    margin-bottom: 20px;
                              }
                              .report-date {
                                    text-align: right;
                                    color: #666;
                                    font-size: 12px;
                                    margin-bottom: 15px;
                              }
                              .section {
                                    margin-bottom: 25px;
                              }
                              .footer {
                                    text-align: center;
                                    margin-top: 30px;
                                    font-size: 10px;
                                    color: #999;
                                    position: absolute;
                                    bottom: 20px;
                                    width: 100%;
                              }
                              hr {
                                    border: 0;
                                    height: 1px;
                                    background: #ddd;
                                    margin: 20px 0;
                              }
                              .stats-card {
                                    background: #f8f9fa;
                                    border-radius: 8px;
                                    padding: 15px;
                                    margin: 10px 0;
                                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                              }
                              .stats-grid {
                                    display: grid;
                                    grid-template-columns: repeat(3, 1fr);
                                    gap: 15px;
                                    margin: 15px 0;
                              }
                              .stat-item {
                                    background: white;
                                    padding: 10px;
                                    border-radius: 6px;
                                    text-align: center;
                              }
                              .stat-value {
                                    font-size: 24px;
                                    font-weight: bold;
                                    color: #00539c;
                              }
                              .stat-label {
                                    font-size: 14px;
                                    color: #666;
                              }
                        </style>
                        
                        <div class="report-header">
                              <h1>PCB缺陷检测报告</h1>
                        </div>
                        
                        <div class="report-date">
                              报告生成时间: ${dateStr} ${timeStr}
                        </div>
                        
                        <hr>
                        
                        <div class="section">
                              <h2>批次检测概述</h2>
                              <div class="stats-grid">
                                    <div class="stat-item">
                                          <div class="stat-value">${batchStatistics.totalImages}</div>
                                          <div class="stat-label">检测总图片数</div>
                                    </div>
                                    <div class="stat-item">
                                          <div class="stat-value">${batchStatistics.totalDefects}</div>
                                          <div class="stat-label">检出总缺陷数</div>
                                    </div>
                                    <div class="stat-item">
                                          <div class="stat-value">${batchStatistics.averageDefectsPerImage}</div>
                                          <div class="stat-label">平均每图缺陷数</div>
                                    </div>
                              </div>
                              
                              <div class="stats-card">
                                    <h3>批次缺陷类型分布</h3>
                                    <table>
                                          <thead>
                                                <tr>
                                                      <th>缺陷类型</th>
                                                      <th>数量</th>
                                                      <th>占比</th>
                                                </tr>
                                          </thead>
                                          <tbody>
                                                ${batchStatsRows}
                                          </tbody>
                                    </table>
                              </div>
                        </div>
                        
                        <hr>
                        
                        <div class="section">
                              <h2>当前图片检测详情</h2>
                              <p>图片序号: ${currentImageIndex + 1}/${imageList.length}</p>
                              <table>
                                    <thead>
                                          <tr>
                                                <th>缺陷ID</th>
                                                <th>缺陷类型</th>
                                                <th>位置坐标(x1,y1,x2,y2)</th>
                                                <th>置信度</th>
                                          </tr>
                                    </thead>
                                    <tbody>
                                          ${currentImageDefectsRows}
                                    </tbody>
                              </table>
                        </div>
                        
                        <div class="footer">
                              PCB缺陷检测系统
                        </div>
                  </div>
                  `;

                  // 使用html2canvas将HTML转换为canvas
                  import('html2canvas').then(html2canvasModule => {
                        const html2canvas = html2canvasModule.default;
                        html2canvas(reportContainer, {
                              scale: 2, // 提高清晰度
                              useCORS: true,
                              logging: false
                        }).then(canvas => {
                              // 创建PDF
                              import('jspdf').then(jsPdfModule => {
                                    const { jsPDF } = jsPdfModule;

                                    const imgData = canvas.toDataURL('image/png');
                                    const pdf = new jsPDF({
                                          orientation: 'portrait',
                                          unit: 'mm',
                                          format: 'a4'
                                    });

                                    // 计算合适的图像尺寸以适合A4页面
                                    const imgWidth = 210; // A4宽度，单位mm
                                    const pageHeight = 297; // A4高度，单位mm
                                    const imgHeight = canvas.height * imgWidth / canvas.width;

                                    let heightLeft = imgHeight;
                                    let position = 0;

                                    // 添加第一页
                                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                                    heightLeft -= pageHeight;

                                    // 如果内容超过一页，添加更多页面
                                    while (heightLeft > 0) {
                                          position = heightLeft - imgHeight;
                                          pdf.addPage();
                                          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                                          heightLeft -= pageHeight;
                                    }

                                    // 添加文件名，包含时间戳以避免重复
                                    const timestamp = now.getTime();
                                    const filename = `PCB缺陷检测报告_${timestamp}.pdf`;

                                    // 保存PDF文件
                                    pdf.save(filename);

                                    // 清理临时DOM元素
                                    document.body.removeChild(reportContainer);

                                    // 关闭加载提示并显示成功消息
                                    message.destroy();
                                    message.success('报告已成功导出');
                              });
                        });
                  });
            } catch (error) {
                  // 发生错误时关闭加载提示并显示错误消息
                  message.destroy();
                  console.error("导出报告出错:", error);
                  message.error('导出报告失败: ' + error.message);

                  // 确保清理可能的临时DOM元素
                  const reportContainer = document.querySelector('div[style*="-9999px"]');
                  if (reportContainer) {
                        document.body.removeChild(reportContainer);
                  }
            }
      };

      const getChartOption = () => {
            // 检查是否有有效的统计数据
            const defectTypes = detectionResults?.statistics?.defect_types;
            if (!defectTypes || Object.keys(defectTypes).length === 0) {
                  return {
                        tooltip: { trigger: 'item' },
                        legend: { show: false },
                        series: [] // 返回空的 series，避免绘制灰色圆
                  };
            }

            // 获取所有缺陷类型
            const defectNames = Object.keys(defectTypes);

            // 为每种缺陷类型生成对应的颜色
            const colors = defectNames.map(name => {
                  // 将中文名称映射到英文键名以获取颜色
                  const colorKey = (() => {
                        switch (name) {
                              case '鼠咬': return 'mouse_bite';
                              case '开路': return 'open_circuit';
                              case '短路': return 'short';
                              case '毛刺': return 'spur';
                              case '杂铜': return 'spurious_copper';
                              default: return name.toLowerCase();
                        }
                  })();

                  return getDefectColor(colorKey);
            });

            return {
                  tooltip: {
                        trigger: 'item',
                        formatter: '{a} <br/>{b}: {c} ({d}%)'
                  },
                  legend: {
                        orient: 'horizontal',
                        bottom: 10,
                        left: 'center',
                        data: defectNames,
                        itemGap: 15,
                        height: 50
                  },
                  color: colors,
                  series: [
                        {
                              name: '缺陷类型',
                              type: 'pie',
                              radius: '65%',
                              center: ['50%', '40%'],
                              data: Object.entries(defectTypes).map(([name, value]) => ({
                                    value,
                                    name
                              })),
                              label: {
                                    show: true,
                                    position: 'outside',
                                    alignTo: 'labelLine',
                                    margin: 20,
                                    formatter: '{b}\n{c} ({d}%)',
                                    lineHeight: 15,
                                    rich: {
                                          b: {
                                                width: 60,
                                                align: 'left'
                                          }
                                    }
                              },
                              labelLine: {
                                    show: true,
                                    length: 15,
                                    length2: 20,
                                    minTurnAngle: 120,
                                    maxSurfaceAngle: 80
                              },
                              emphasis: {
                                    itemStyle: {
                                          shadowBlur: 10,
                                          shadowOffsetX: 0,
                                          shadowColor: 'rgba(0, 0, 0, 0.5)'
                                    }
                              }
                        }
                  ]
            };
      };
      const handleImageWrapperClick = (e) => {
            // 获取图片元素
            const img = imageWrapperRef.current?.querySelector('img');
            if (!img) return;

            // 获取图片元素的位置和尺寸
            const imgRect = img.getBoundingClientRect();

            // 检查点击是否在图片区域外
            const isOutsideImage = (
                  e.clientX < imgRect.left ||
                  e.clientX > imgRect.right ||
                  e.clientY < imgRect.top ||
                  e.clientY > imgRect.bottom
            );

            if (isOutsideImage) {
                  // 重置缩放和位置
                  setScale(1);
                  setPosition({ x: 0, y: 0 });
            }
      };

      const handleLoginSuccess = (user) => {
            setIsLoggedIn(true);
            setCurrentUser(user);
      };

      const handleLogout = () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setIsLoggedIn(false);
            setCurrentUser(null);
      };

      // 添加在其他useEffect之后
      // 监听imageDimensions的变化，确保在渲染边界框前已获取图像尺寸
      useEffect(() => {
            // 当imageDimensions变化时，重新计算和应用边界框
            if (imageDimensions && detectionResults && detectionResults.defects) {
                  console.log('图像尺寸更新，重新应用边界框:', imageDimensions);
                  // 触发边界框重新应用
                  filterDefects(defectFilter);
            }
      }, [imageDimensions]);

      // 添加一个useEffect来监听视频元素的大小和位置变化
      useEffect(() => {
            if (isCameraActive && videoRef.current) {
                  // 创建一个ResizeObserver来监听视频元素的大小变化
                  const resizeObserver = new ResizeObserver(() => {
                        // 触发边界框重新渲染
                        if (processedResults && processedResults.length > 0) {
                              console.log('视频元素尺寸变化，重新应用边界框');
                              // 创建一个新的过滤结果副本以触发渲染
                              setProcessedResults([...processedResults]);
                        }
                  });

                  // 开始观察视频元素
                  resizeObserver.observe(videoRef.current);

                  // 清理函数
                  return () => {
                        resizeObserver.disconnect();
                  };
            }
      }, [isCameraActive, videoRef.current, processedResults]);

      if (!isLoggedIn) {
            return <Login onLoginSuccess={handleLoginSuccess} />;
      }

      return (
            <Layout className="app-container">
                  <Header className="header">
                        <div className="header-left">
                              <img src="/logo.svg" alt="logo" className="logo" />
                              <h1>基于YOLOv11和投票融合的PCB缺陷检测系统</h1>
                        </div>
                        <div className="header-right">
                              <SettingOutlined className="header-icon" />
                              <BulbOutlined className="header-icon" />
                              <Tooltip title="退出登录">
                                    <UserOutlined className="header-icon" onClick={handleLogout} style={{ cursor: 'pointer' }} />
                              </Tooltip>
                        </div>
                  </Header>
                  <Layout style={{ padding: '24px', background: '#f0f2f5' }}>
                        <div style={{ display: 'flex', gap: '24px', minWidth: 'fit-content' }}>
                              <div className="sidebar">
                                    <Button
                                          type="primary"
                                          className="start-detection-button"
                                          style={{
                                                background: (isBatchProcessing && !isPaused) || isCapturing ? '#f5222d' : '#37c537',
                                                border: 'none',
                                          }}
                                          onClick={handleBatchDetection}
                                          icon={isBatchProcessing && !isPaused ? <LoadingOutlined /> : <SearchOutlined />}
                                    >
                                          {isCameraActive && isCapturing ? '停止检测' :
                                                isCameraActive ? '开始检测' :
                                                      isBatchProcessing ? (isPaused ? '继续检测' : '暂停检测') : '开始检测'}
                                    </Button>
                                    <div className="system-status-section">
                                          <h3>系统状态</h3>
                                          <div className="status-item status-cpu" style={{ display: 'flex', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '50px' }}>
                                                      <div className="status-icon status-icon-cpu"></div>
                                                      <span className="status-value" style={{
                                                            marginTop: '5px',
                                                            backgroundColor: 'rgba(24, 144, 255, 0.2)',
                                                            padding: '2px 8px',
                                                            borderRadius: '10px',
                                                            fontSize: '12px',
                                                            color: '#1890ff',
                                                            textAlign: 'center'
                                                      }}>
                                                            {Math.min(Math.max(Math.round(systemStatus.cpuUsage || 0), 0), 100)}%
                                                      </span>
                                                </div>
                                                <div className="status-content" style={{ marginLeft: '10px', marginTop: '2px' }}>
                                                      <div className="status-header">
                                                            <span className="status-label">CPU使用率</span>
                                                      </div>
                                                      <div style={{ position: 'relative' }}>
                                                            <Progress
                                                                  percent={Math.min(Math.max(Math.round(systemStatus.cpuUsage || 0), 0), 100)}
                                                                  size="small"
                                                                  status={systemStatus.cpuUsage > 80 ? 'exception' : 'normal'}
                                                                  showInfo={false}
                                                                  strokeColor={{
                                                                        '0%': '#108ee9',
                                                                        '100%': systemStatus.cpuUsage > 80 ? '#f5222d' : '#52c41a',
                                                                  }}
                                                            />
                                                      </div>
                                                </div>
                                          </div>
                                          <div className="status-item status-memory" style={{ display: 'flex', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '50px' }}>
                                                      <div className="status-icon status-icon-memory"></div>
                                                      <span className="status-value" style={{
                                                            marginTop: '5px',
                                                            backgroundColor: 'rgba(114, 46, 209, 0.2)',
                                                            padding: '2px 8px',
                                                            borderRadius: '10px',
                                                            fontSize: '12px',
                                                            color: '#722ed1',
                                                            textAlign: 'center'
                                                      }}>
                                                            {Math.min(Math.max(Math.round(systemStatus.memoryUsage || 0), 0), 100)}%
                                                      </span>
                                                </div>
                                                <div className="status-content" style={{ marginLeft: '10px', marginTop: '2px' }}>
                                                      <div className="status-header">
                                                            <span className="status-label">内存使用率</span>
                                                      </div>
                                                      <div style={{ position: 'relative' }}>
                                                            <Progress
                                                                  percent={Math.min(Math.max(Math.round(systemStatus.memoryUsage || 0), 0), 100)}
                                                                  size="small"
                                                                  status={systemStatus.memoryUsage > 80 ? 'exception' : 'normal'}
                                                                  showInfo={false}
                                                                  strokeColor={{
                                                                        '0%': '#722ed1',
                                                                        '100%': systemStatus.memoryUsage > 80 ? '#f5222d' : '#13c2c2',
                                                                  }}
                                                            />
                                                      </div>
                                                </div>
                                          </div>
                                          <div className="status-item status-time" style={{ display: 'flex', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '50px' }}>
                                                      <div className="status-icon status-icon-time"></div>
                                                </div>
                                                <div className="status-content" style={{ marginLeft: '10px', marginTop: '2px' }}>
                                                      <div className="status-header">
                                                            <span className="status-label">运行时长</span>
                                                      </div>
                                                      <div style={{
                                                            display: 'flex',
                                                            justifyContent: 'center',
                                                            marginTop: '5px'
                                                      }}>
                                                            <span className="status-time-value" style={{
                                                                  backgroundColor: 'rgba(250, 173, 20, 0.2)',
                                                                  padding: '4px 12px',
                                                                  borderRadius: '30px',
                                                                  fontSize: '12px',
                                                                  color: '#faad14',
                                                                  whiteSpace: 'nowrap',
                                                                  textAlign: 'center'
                                                            }}>
                                                                  {isBatchProcessing || isCapturing ? currentRunTime : (endTime && startTime ? calculateUptime() : '0秒')}
                                                            </span>
                                                      </div>
                                                </div>
                                          </div>
                                    </div>
                                    <div className="sidebar-actions">
                                          <Upload
                                                accept="image/*"
                                                showUploadList={false}
                                                beforeUpload={handleImageUpload}
                                                disabled={isUploading || loading || isCameraActive}
                                          >
                                                <Button className="action-btn" style={{ width: '160px' }} icon={<UploadOutlined className="btn-icon" />} disabled={isUploading || loading || isCameraActive}>
                                                      导入图像
                                                </Button>
                                          </Upload>
                                          <Upload
                                                directory
                                                multiple
                                                accept="image/*"
                                                showUploadList={false}
                                                beforeUpload={() => false}
                                                onChange={debouncedHandleFolderUpload}
                                                disabled={isUploading || loading || isCameraActive}
                                                fileList={[]}
                                          >
                                                <Button className="action-btn" style={{ width: '160px' }} icon={<FolderOutlined className="btn-icon" />} disabled={isUploading || loading || isCameraActive}>
                                                      导入文件夹
                                                </Button>
                                          </Upload>
                                          {/* 添加摄像头按钮 */}
                                          <Button
                                                className="action-btn"
                                                icon={isCameraActive ? <VideoCameraOutlined className="btn-icon" /> : <CameraOutlined className="btn-icon" />}
                                                onClick={handleOpenCamera}
                                                style={{ width: '160px', color: isCameraActive ? '#f5222d' : '' }}
                                          >
                                                {isCameraActive ? '关闭摄像头' : '打开摄像头'}
                                          </Button>
                                          <Button className="action-btn" style={{ width: '160px' }} icon={<SearchOutlined className="btn-icon" />} onClick={handleExportResults}>
                                                导出结果
                                          </Button>
                                          <Button className="action-btn" style={{ width: '160px' }} icon={<FileTextOutlined className="btn-icon" />} onClick={handleExportReport}>
                                                导出报告
                                          </Button>
                                    </div>
                              </div>

                              <div className="image-section">
                                    <div className="image-container" style={
                                          {
                                                height: '100%',
                                                width: '100%',
                                                overflow: 'hidden'
                                          }
                                    }>
                                          <div className="image-wrapper"
                                                onMouseEnter={() => setShowNavigation(true)}
                                                onMouseLeave={() => {
                                                      setShowNavigation(false);
                                                      handleMouseLeave();
                                                }}
                                                onClick={handleImageWrapperClick}
                                          >
                                                {isCameraActive ? (
                                                      // 摄像头模式保持不变
                                                      <div
                                                            ref={imageWrapperRef}
                                                            className="image-scale-wrapper camera-active"
                                                            style={{
                                                                  position: 'relative',
                                                                  width: '100%',
                                                                  height: '100%',
                                                                  backgroundColor: '#000',
                                                                  overflow: 'hidden'
                                                            }}
                                                      >
                                                            {/* 视频元素 */}
                                                            <video
                                                                  ref={videoRef}
                                                                  autoPlay
                                                                  playsInline
                                                                  muted
                                                                  style={{
                                                                        position: 'absolute',
                                                                        top: 0,
                                                                        left: 0,
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        objectFit: 'contain',
                                                                        display: 'block',
                                                                        zIndex: 10
                                                                  }}
                                                            />

                                                            {/* 边界框层 */}
                                                            <div
                                                                  style={{
                                                                        position: 'absolute',
                                                                        top: 0,
                                                                        left: 0,
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        pointerEvents: 'none',
                                                                        zIndex: 20
                                                                  }}
                                                            >
                                                                  {renderBoundingBoxes()}
                                                            </div>

                                                            {/* 检测状态指示 */}
                                                            {isCapturing && (
                                                                  <div
                                                                        style={{
                                                                              position: 'absolute',
                                                                              top: 10,
                                                                              right: 10,
                                                                              backgroundColor: 'rgba(24, 144, 255, 0.8)',
                                                                              color: 'white',
                                                                              padding: '4px 8px',
                                                                              borderRadius: '4px',
                                                                              fontSize: '12px',
                                                                              zIndex: 30
                                                                        }}
                                                                  >
                                                                        实时检测中...
                                                                  </div>
                                                            )}
                                                      </div>
                                                ) : selectedImage ? (
                                                      <>
                                                            <div
                                                                  ref={imageWrapperRef}
                                                                  className="image-scale-wrapper"
                                                                  onMouseDown={handleMouseDown}
                                                                  onMouseMove={handleMouseMove}
                                                                  onMouseUp={handleMouseUp}
                                                                  onMouseLeave={handleMouseLeave}
                                                                  onWheel={handleWheel}
                                                                  style={{
                                                                        cursor: isDragging ? 'grabbing' : 'grab',
                                                                        position: 'relative',
                                                                        width: imageDimensions?.width || 'auto',
                                                                        height: imageDimensions?.height || 'auto',
                                                                        maxWidth: '600px',
                                                                        maxHeight: '600px'
                                                                  }}
                                                            >
                                                                  {/* 使用相对定位，并在transform中应用缩放和平移 */}
                                                                  <div style={{
                                                                        position: 'relative',
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                                                                        transformOrigin: 'center',
                                                                        transition: isDragging ? 'none' : 'transform 0.1s ease',
                                                                  }}>
                                                                        <img
                                                                              src={selectedImage}
                                                                              alt="PCB"
                                                                              style={{
                                                                                    width: '100%',
                                                                                    height: '100%',
                                                                                    objectFit: 'contain',
                                                                                    userSelect: 'none'
                                                                              }}
                                                                              draggable={false}
                                                                        />
                                                                        {/* 边界框相对于图像定位 */}
                                                                        {renderBoundingBoxes()}
                                                                  </div>
                                                            </div>
                                                            {imageList.length > 1 && showNavigation && (
                                                                  <div className="image-navigation">
                                                                        <Button
                                                                              icon={<LeftOutlined />}
                                                                              onClick={handlePrevImage}
                                                                              disabled={currentImageIndex === 0}
                                                                        />
                                                                        <Button
                                                                              icon={<RightOutlined />}
                                                                              onClick={handleNextImage}
                                                                              disabled={currentImageIndex === imageList.length - 1}
                                                                        />
                                                                  </div>
                                                            )}
                                                      </>
                                                ) : (
                                                      <div className="upload-placeholder">
                                                            <Upload
                                                                  accept="image/*"
                                                                  showUploadList={false}
                                                                  beforeUpload={handleImageUpload} // 处理单个图片上传
                                                                  onDrop={(e) => {
                                                                        const file = e.dataTransfer.files[0];
                                                                        if (file) {
                                                                              handleImageUpload(file);
                                                                        }
                                                                  }}
                                                            >
                                                                  <div style={{ textAlign: 'center', cursor: 'pointer' }}>
                                                                        <UploadOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
                                                                        <p>点击或拖拽上传图片</p>
                                                                  </div>
                                                            </Upload>
                                                      </div>
                                                )}
                                          </div>
                                          <div className="detection-progress">
                                                <span>检测进度:</span>
                                                <div style={{
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      marginTop: '5px',
                                                      gap: '10px'
                                                }}>
                                                      <div style={{ flex: 1, position: 'relative' }}>
                                                            <Progress
                                                                  percent={detectionProgress}
                                                                  showInfo={false}
                                                            />
                                                      </div>
                                                      <span style={{
                                                            fontSize: '14px',
                                                            color: '#1890ff',
                                                            fontWeight: '500'
                                                      }}>
                                                            {detectionProgress}%
                                                      </span>
                                                </div>
                                          </div>
                                          {imageList.length > 1 && (
                                                <div className="image-pagination">
                                                      <Pagination
                                                            current={currentImageIndex + 1}
                                                            total={imageList.length}
                                                            pageSize={1}
                                                            onChange={handlePageChange}
                                                            size="small"
                                                            showQuickJumper
                                                            showSizeChanger={false}
                                                      />
                                                </div>
                                          )}
                                    </div>
                              </div>

                              <div className="results-section" >
                                    <div className="results-header">
                                          <h2>检测结果</h2>
                                          <Select
                                                style={{ width: '100%', marginTop: '8px' }}
                                                value={defectFilter}
                                                onChange={handleDefectFilterChange}
                                          >
                                                {defectTypes.map(type => (
                                                      <Select.Option key={type} value={type}>
                                                            {type === 'all' ? '全部缺陷' : type}
                                                      </Select.Option>
                                                ))}
                                          </Select>
                                    </div>
                                    {/* 检测结果列表部分 */}
                                    <div
                                          className="defects-container"
                                          style={{
                                                height: '350px', // 固定高度
                                                overflow: 'auto',
                                                marginBottom: '16px',
                                          }}
                                    >
                                          <div
                                                className="defects-list"
                                                ref={defectsListRef}
                                          >
                                                {processedResults.length > 0 ? (
                                                      processedResults.map((defect, index) => (
                                                            <div key={index} className="defect-item">
                                                                  <div className="defect-info">
                                                                        <h4><span className="label-width">类别:</span> {defect.type}</h4>
                                                                        {defect.bbox && (
                                                                              <p className="coordinates-info">
                                                                                    <span className="coord-row">
                                                                                          <span className="label-width">坐标:</span>
                                                                                          <span className="coord-pair">x1={defect.bbox.x1}</span>
                                                                                          <span className="coord-pair">y1={defect.bbox.y1}</span>
                                                                                    </span>
                                                                                    <span className="coord-row">
                                                                                          <span className="label-width"></span>
                                                                                          <span className="coord-pair">x2={defect.bbox.x2}</span>
                                                                                          <span className="coord-pair">y2={defect.bbox.y2}</span>
                                                                                    </span>
                                                                              </p>
                                                                        )}
                                                                        {defect.confidence && <p><span className="label-width">置信度:</span> {defect.confidence}%</p>}
                                                                  </div>
                                                            </div>
                                                      ))
                                                ) : (
                                                      <div className="defect-item empty-defect">
                                                            <div className="defect-info">
                                                                  <h4>暂无检测结果</h4>
                                                                  <p>开始检测后将在此显示详细信息</p>
                                                            </div>
                                                      </div>
                                                )}
                                          </div>
                                    </div>
                                    {/* 饼图和图例部分 */}
                                    <div className="statistics-section" style={{ flex: '2', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                                          {detectionResults.statistics.defect_types && Object.keys(detectionResults.statistics.defect_types).length > 0 ? (
                                                <ReactECharts
                                                      option={getChartOption()}
                                                      style={{ height: '100%', flex: 1 }}
                                                      notMerge={true}
                                                />
                                          ) : (
                                                <div style={{
                                                      display: 'flex',
                                                      flexDirection: 'column',
                                                      justifyContent: 'center',
                                                      alignItems: 'center',
                                                      height: '100%',
                                                      color: '#aaa'
                                                }}>
                                                      <p style={{ margin: 0 }}>检测完成后将在此显示统计数据</p>
                                                      <p style={{ margin: 0 }}>
                                                            可检测: 鼠咬, 开路, 短路, 毛刺和杂铜等
                                                      </p>
                                                </div>
                                          )}
                                    </div>
                              </div>

                              <div className="model-section">
                                    <div className="model-header">
                                          <h2>模型管理</h2>
                                          <Select
                                                value={selectedModel}
                                                onChange={handleModelChange}
                                                style={{ width: '100%' }}
                                          >
                                                <Select.Option value="yolov11">Yolov11</Select.Option>
                                                <Select.Option value="yolov11-vote2">Yolov11-vote2</Select.Option>
                                                <Select.Option value="yolov11-vote4">Yolov11-vote4</Select.Option>
                                          </Select>
                                    </div>
                                    <div className="metrics">
                                          <div className="metric-item">
                                                <span>Precision</span>
                                                <span className="metric-value">
                                                      {selectedModel === 'yolov11' ? '97.72%' :
                                                            selectedModel === 'yolov11-vote2' ? '97.45%' :
                                                                  '96.99%'}
                                                </span>
                                          </div>
                                          <div className="metric-item">
                                                <span>Recall</span>
                                                <span className="metric-value">
                                                      {selectedModel === 'yolov11' ? '84.41%' :
                                                            selectedModel === 'yolov11-vote2' ? '85.97%' :
                                                                  '87.32%'}
                                                </span>
                                          </div>
                                          <div className="metric-item">
                                                <span>mAP@0.5</span>
                                                <span className="metric-value">
                                                      {selectedModel === 'yolov11' ? '92.39%' :
                                                            selectedModel === 'yolov11-vote2' ? '93.02%' :
                                                                  '93.58%'}
                                                </span>
                                          </div>
                                          <div className="metric-item">
                                                <span>mAP@0.5:0.95</span>
                                                <span className="metric-value">
                                                      {selectedModel === 'yolov11' ? '68.18%' :
                                                            selectedModel === 'yolov11-vote2' ? '69.20%' :
                                                                  '69.49%'}
                                                </span>
                                          </div>
                                    </div>
                                    <div className="threshold-settings">
                                          <h3>阈值设置</h3>
                                          <div className="threshold-item">
                                                <span>IoU 阈值</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                      {/* 左侧显示当前值并支持用户输入 */}
                                                      <div className="custom-input-number">
                                                            <InputNumber
                                                                  min={0.1}
                                                                  max={1.0}
                                                                  step={0.01}
                                                                  value={iouThreshold}
                                                                  onChange={(value) => setIouThreshold(value || 0.1)} // 防止输入为空
                                                                  style={{ width: '80px' }}
                                                                  controls={false}
                                                                  className="threshold-input"
                                                            />
                                                            <div className="custom-controls">
                                                                  <div className="control-up" onClick={() => {
                                                                        const newValue = parseFloat((iouThreshold + 0.01).toFixed(2));
                                                                        if (newValue <= 1.0) setIouThreshold(newValue);
                                                                  }}>
                                                                        <div className="control-icon">+</div>
                                                                  </div>
                                                                  <div className="control-down" onClick={() => {
                                                                        const newValue = parseFloat((iouThreshold - 0.01).toFixed(2));
                                                                        if (newValue >= 0.1) setIouThreshold(newValue);
                                                                  }}>
                                                                        <div className="control-icon">-</div>
                                                                  </div>
                                                            </div>
                                                      </div>
                                                      {/* 右侧滑动条 */}
                                                      <Slider
                                                            min={0.1}
                                                            max={1.0}
                                                            step={0.01}
                                                            value={iouThreshold}
                                                            onChange={(value) => setIouThreshold(value)}
                                                            tooltip={{ formatter: (value) => `IoU: ${value.toFixed(2)}` }}
                                                            style={{ flex: 1 }}
                                                      />
                                                </div>
                                          </div>
                                          <div className="threshold-item">
                                                <span>置信度阈值</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                      {/* 左侧显示当前值并支持用户输入 */}
                                                      <div className="custom-input-number">
                                                            <InputNumber
                                                                  min={0.1}
                                                                  max={1.0}
                                                                  step={0.01}
                                                                  value={confThreshold}
                                                                  onChange={(value) => setConfThreshold(value || 0.1)} // 防止输入为空
                                                                  style={{ width: '80px' }}
                                                                  controls={false}
                                                                  className="threshold-input"
                                                            />
                                                            <div className="custom-controls">
                                                                  <div className="control-up" onClick={() => {
                                                                        const newValue = parseFloat((confThreshold + 0.01).toFixed(2));
                                                                        if (newValue <= 1.0) setConfThreshold(newValue);
                                                                  }}>
                                                                        <div className="control-icon">+</div>
                                                                  </div>
                                                                  <div className="control-down" onClick={() => {
                                                                        const newValue = parseFloat((confThreshold - 0.01).toFixed(2));
                                                                        if (newValue >= 0.1) setConfThreshold(newValue);
                                                                  }}>
                                                                        <div className="control-icon">-</div>
                                                                  </div>
                                                            </div>
                                                      </div>
                                                      {/* 右侧滑动条 */}
                                                      <Slider
                                                            min={0.1}
                                                            max={1.0}
                                                            step={0.01}
                                                            value={confThreshold}
                                                            onChange={(value) => setConfThreshold(value)}
                                                            tooltip={{ formatter: (value) => `Conf: ${value.toFixed(2)}` }}
                                                            style={{ flex: 1 }}
                                                      />
                                                </div>
                                          </div>
                                    </div>
                              </div>
                        </div>
                  </Layout>
            </Layout>
      );
}

export default App