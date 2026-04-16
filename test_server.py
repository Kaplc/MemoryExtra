"""测试用 Flask 服务器 - 无 GUI"""
import os
import sys

_BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_BASE, 'backend'))

os.environ.setdefault('QDRANT_EMBEDDING_MODEL', os.path.join(_BASE, 'models', 'bge-m3'))
os.environ.setdefault('QDRANT_EMBEDDING_DIM', '1024')
os.environ.setdefault('QDRANT_EXE_PATH', os.path.join(_BASE, 'qdrant', 'qdrant.exe'))
os.environ.setdefault('FORCE_CPU', '1')
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'

from flask import Flask
from flask_cors import CORS

app = Flask(__name__, static_folder=os.path.join(_BASE, 'web'), static_url_path='')
CORS(app)

# 模拟 ready_state
_ready = {"model": True, "qdrant": True, "device": "cpu"}

# 初始化核心模块
from core.logger import setup_logger
logger = setup_logger(_BASE)

from core.database import StatsDB
stats_db = StatsDB(os.path.join(_BASE, 'backend', 'stats.db'))

# 注册路由
from modules.status import register as reg_status
reg_status(app, _ready, logger, stats_db)

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/health', methods=['GET'])
def health():
    return {"status": "ok"}

if __name__ == '__main__':
    print("Starting test server on http://127.0.0.1:18765")
    app.run(host='127.0.0.1', port=18765, debug=False, use_reloader=False)
