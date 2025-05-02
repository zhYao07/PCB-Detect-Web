from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from datetime import datetime
import sqlite3
from itsdangerous import URLSafeTimedSerializer as Serializer
import torch

# 导入多角度投票融合模型
from v11 import YOLOv11Ensemble

app = Flask(__name__, static_folder='frontend/build', static_url_path='')
CORS(app)

# Configure secret key for token generation
app.config['SECRET_KEY'] = 'supersecretkey'

# 添加根路由，返回前端应用
@app.route('/')
def serve_frontend():
    return send_from_directory(app.static_folder, 'index.html')

# 添加通配符路由，处理前端路由
@app.route('/<path:path>')
def serve_static(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# Initialize users database
def init_db():
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT UNIQUE NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# 检测系统是否有可用的GPU
def check_gpu_status():
    gpu_available = torch.cuda.is_available()
    gpu_info = None
    if gpu_available:
        gpu_count = torch.cuda.device_count()
        gpu_info = {
            'count': gpu_count,
            'name': [torch.cuda.get_device_name(i) for i in range(gpu_count)]
        }
    return {'available': gpu_available, 'info': gpu_info}

# 显示GPU状态信息
gpu_status = check_gpu_status()
if gpu_status['available']:
    print(f"GPU已检测到: {gpu_status['info']['count']} 个设备")
    for i, name in enumerate(gpu_status['info']['name']):
        print(f"  GPU {i}: {name}")
else:
    print("未检测到GPU, 将使用CPU进行推理")

# 确保上传目录存在
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/api/detect', methods=['POST'])
def detect_pcb():
    try:
        # 获取上传的图片
        file = request.files['image']
        if not file:
            return jsonify({'error': 'No image provided'}), 400

        # 获取模型参数
        vote_threshold = int(request.args.get('vote_threshold', 1))  # 默认值为1
        orientation_count = int(request.args.get('orientation_count', 1))  # 默认值为1
        iou_threshold = float(request.args.get('iou_threshold', 0.45))  # 默认值为0.45
        conf_threshold = float(request.args.get('conf_threshold', 0.4))  # 默认值为0.4
        imgsz = int(request.args.get('imgsz', 600))  # 默认值为600
        
        # 初始化模型时自动选择设备（GPU或CPU）并传入imgsz参数
        # 修复错误：使用固定的imgsz值600
        model = YOLOv11Ensemble('best.pt', conf_thres=conf_threshold, iou_thres=iou_threshold, imgsz=1280)
        
        # 保存图片
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        image_path = os.path.join(UPLOAD_FOLDER, f'pcb_{timestamp}.jpg')
        file.save(image_path)

        # 使用模型运行检测
        result = model.predict(image_path, vote_threshold=vote_threshold, orientation_count=orientation_count)

        # 处理检测结果
        defects = []
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            confidence = box.conf[0].item()
            class_id = box.cls[0].item()
            class_name = result.names[int(class_id)]
            
            defects.append({
                'type': class_name,
                'position': {
                    'x': int((x1 + x2) / 2),
                    'y': int((y1 + y2) / 2)
                },
                'bbox': {
                    'x1': int(x1),
                    'y1': int(y1),
                    'x2': int(x2),
                    'y2': int(y2)
                },
                'confidence': round(confidence * 100, 2),
                'severity': 'severe' if confidence > 0.8 else 'moderate' if confidence > 0.5 else 'minor'
            })

        # 统计信息
        stats = {
            'total_defects': len(defects),
            'defect_types': {},
            'accuracy': round(sum(d['confidence'] for d in defects) / len(defects) if defects else 0, 2)
        }

        for defect in defects:
            if defect['type'] not in stats['defect_types']:
                stats['defect_types'][defect['type']] = 0
            stats['defect_types'][defect['type']] += 1

        return jsonify({
            'status': 'success',
            'defects': defects,
            'statistics': stats,
            'image_dimensions': {
                'width': result.orig_shape[1],
                'height': result.orig_shape[0]
            },
            'using_gpu': torch.cuda.is_available(),  # 添加GPU使用信息
            'imgsz': imgsz  # 返回使用的图像尺寸
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/system-status', methods=['GET'])
def get_system_status():
    import psutil
    cpu_usage = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    memory_usage = memory.percent
    uptime = psutil.boot_time()
    import datetime
    uptime_duration = datetime.datetime.now() - datetime.datetime.fromtimestamp(uptime)
    hours = int(uptime_duration.total_seconds() // 3600)
    minutes = int((uptime_duration.total_seconds() % 3600) // 60)
    
    # 获取GPU状态
    gpu_info = {}
    if torch.cuda.is_available():
        gpu_count = torch.cuda.device_count()
        gpu_info['count'] = gpu_count
        gpu_info['devices'] = []
        
        for i in range(gpu_count):
            try:
                # 这部分代码需要安装nvidia-ml-py库才能获取GPU利用率
                import pynvml
                pynvml.nvmlInit()
                handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                gpu_info['devices'].append({
                    'name': torch.cuda.get_device_name(i),
                    'utilization': util.gpu
                })
            except ImportError:
                gpu_info['devices'].append({
                    'name': torch.cuda.get_device_name(i),
                    'utilization': 'unknown (pynvml not installed)'
                })
            except Exception as e:
                gpu_info['devices'].append({
                    'name': torch.cuda.get_device_name(i),
                    'utilization': f'error: {str(e)}'
                })
    
    # 获取当前机器的IP地址
    import socket
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    
    return jsonify({
        'status': 'normal',
        'cpu_usage': cpu_usage,
        'memory_usage': memory_usage,
        'uptime': f'{hours}h {minutes}m',
        'gpu_available': torch.cuda.is_available(),
        'gpu_info': gpu_info if torch.cuda.is_available() else None,
        'server_ip': local_ip
    })

# User registration endpoint
@app.route('/api/register', methods=['POST'])
def register_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    phone = data.get('phone')
    if not all([username, password, email, phone]):
        return jsonify({'error': '缺少必填字段'}), 400
    try:
        conn = sqlite3.connect('users.db')
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO users (username, password, email, phone) VALUES (?, ?, ?, ?)',
            (username, password, email, phone)
        )
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': '用户注册成功'}), 200
    except sqlite3.IntegrityError as e:
        msg = '注册失败'
        err = str(e)
        if 'username' in err:
            msg = '用户名已存在'
        elif 'email' in err:
            msg = '邮箱已存在'
        elif 'phone' in err:
            msg = '手机号已存在'
        return jsonify({'error': msg}), 400

# User login endpoint
@app.route('/api/login', methods=['POST'])
def login_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not all([username, password]):
        return jsonify({'error': '缺少用户名或密码'}), 400
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute(
        'SELECT id, username, email, phone FROM users WHERE username=? AND password=?',
        (username, password)
    )
    row = cursor.fetchone()
    conn.close()
    if row:
        user_id, uname, email, phone = row
        # Generate token without TimedJSONWebSignatureSerializer
        s = Serializer(app.config['SECRET_KEY'])
        token = s.dumps({'user_id': user_id})
        user_info = {'id': user_id, 'username': uname, 'email': email, 'phone': phone}
        return jsonify({'status': 'success', 'token': token, 'user': user_info}), 200
    else:
        return jsonify({'error': '用户名或密码错误'}), 401

if __name__ == '__main__':
    # 获取本机IP地址
    import socket
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    
    print(f"\n=== 应用启动信息 ===")
    print(f"本地访问地址: http://localhost:5000")
    print(f"局域网访问地址: http://{local_ip}:5000")
    print(f"请确保防火墙允许5000端口的访问")
    print("===================\n")
    
    # 设置host为'0.0.0.0'使其监听所有网络接口
    app.run(host='0.0.0.0', port=5000, debug=True)