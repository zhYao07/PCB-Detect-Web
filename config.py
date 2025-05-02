class Config:
    # MySQL配置
    MYSQL_HOST = 'localhost'
    MYSQL_USER = 'root'  # 请修改为你的MySQL用户名
    MYSQL_PASSWORD = 'mysql'  # 请修改为你的MySQL密码
    MYSQL_DB = 'pcb_detect'
    SQLALCHEMY_DATABASE_URI = f'mysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DB}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT配置
    JWT_SECRET_KEY = 'your-secret-key'  # 请修改为随机的安全密钥
    JWT_ACCESS_TOKEN_EXPIRES = 24 * 3600  # token有效期24小时 