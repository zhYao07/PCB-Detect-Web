# PCB缺陷检测系统

这是一个基于YOLOv11的PCB缺陷检测系统，包含前端界面和后端API。

## 功能特点

- 实时PCB图像缺陷检测
- 直观的可视化界面
- 缺陷位置标注
- 统计数据分析
- 系统状态监控
- 用户登录与注册功能
- 批量检测与结果导出

## 系统演示
![image](https://github.com/user-attachments/assets/584d085a-dbcc-4425-af5f-f5af5b5e4316)
![image](https://github.com/user-attachments/assets/99dcd05a-6762-4243-bf4c-952b1b6a35f9)


## 系统要求

- Windows 10/11 或 Linux 系统
- Python 3.9+ 
- Node.js 16+
- npm 6+
- CUDA支持的NVIDIA GPU（可选，用于加速检测）

## 详细安装步骤

### 1. 准备环境

#### 安装Python环境
1. 从[Python官网](https://www.python.org/downloads/)下载并安装Python 3.9或更高版本
2. 确保安装时勾选"Add Python to PATH"选项

#### 安装Node.js和npm
1. 从[Node.js官网](https://nodejs.org/)下载并安装Node.js 16或更高版本
2. npm会随Node.js一起安装

#### GPU支持（可选）
如果您有NVIDIA GPU，建议安装CUDA和cuDNN以加速检测：
1. 安装CUDA Toolkit 11.0+，[下载地址](https://developer.nvidia.com/cuda-downloads)
2. 安装对应版本的cuDNN，[下载地址](https://developer.nvidia.com/cudnn)

### 2. 获取项目代码

```bash
git clone <repository-url>
cd PCB_Detect
```

### 3. 安装后端依赖

```bash
pip install -r requirements.txt
```

如果您使用的是GPU，确保安装了PyTorch的GPU版本：
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 4. 安装前端依赖

```bash
cd frontend
npm install
cd ..
```

### 5. 准备模型文件

确保模型文件`best.pt`位于项目根目录。如果没有该文件，请联系项目管理员获取。

### 6. 创建上传目录

```bash
mkdir -p uploads
```

## 运行系统

### 1. 启动后端服务

```bash
python app.py
```

成功启动后，终端会显示：
- 检测到的GPU信息（如果有）
- "未检测到GPU, 将使用CPU进行推理"（如果没有GPU）
- Flask服务器启动信息

### 2. 启动前端服务

在新的终端窗口中：

```bash
cd frontend
npm start
```

### 3. 访问系统

打开浏览器访问 http://localhost:5000

## 系统使用说明

### 用户登录/注册
1. 首次使用需注册账号
2. 使用注册的用户名和密码登录系统

### 基本操作
1. 单张图片检测：点击"开始检测"按钮上传PCB图片
2. 摄像头实时检测：点击"开启摄像头"进行实时检测
3. 批量检测：点击"批量检测"上传多张图片进行检测

### 结果查看与导出
1. 检测结果将在界面上显示，包括缺陷位置标注、类型和置信度
2. 使用"导出结果"功能可将检测结果导出为Excel文件
3. "生成报告"功能可创建详细的PDF检测报告

### 系统配置
1. 可在界面上调整检测参数，如置信度阈值、IOU阈值等
2. 可查看系统状态，包括CPU/GPU使用率、运行时间等

## 常见问题解决

1. **模型加载失败**
   - 确认`best.pt`文件位于正确位置
   - 检查GPU驱动和CUDA版本是否兼容

2. **前端无法连接后端**
   - 确认后端服务器已正常启动
   - 检查防火墙设置是否阻止了端口访问

3. **检测速度慢**
   - 如有GPU，确保CUDA正确安装
   - 可尝试减小图像处理尺寸（在UI界面调整）

4. **安装依赖失败**
   - 尝试使用国内镜像源：`pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple`
   - 对于npm：`npm install --registry=https://registry.npm.taobao.org`

## 注意事项

- 建议使用Chrome或Firefox最新版本访问系统
- 大尺寸图片检测可能需要较长时间，请耐心等待
- GPU加速可显著提高检测速度
- 系统状态页面可帮助监控资源使用情况

## 联系支持

如有任何问题或需要技术支持，请联系项目维护人员。

## 文件结构

```
pcb-detect/
├── app.py              # 后端Flask应用
├── requirements.txt    # Python依赖
├── best.pt            # YOLOv11模型文件
├── frontend/          # 前端React应用
│   ├── src/
│   │   ├── App.js
│   │   └── App.css
│   └── package.json
└── README.md
``` 
