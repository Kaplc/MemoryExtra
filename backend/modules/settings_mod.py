"""设置路由：/settings, /reload-model"""
import os
import threading
import torch
from flask import request, jsonify


def register(app, settings_mgr, model_mgr):
    @app.route('/settings', methods=['GET'])
    def get_settings():
        return jsonify(settings_mgr.load())

    @app.route('/settings', methods=['POST'])
    def save_settings():
        data = request.get_json() or {}
        current = settings_mgr.load()
        current.update({k: v for k, v in data.items() if k in ('device',)})
        settings_mgr.save(current)
        return jsonify({"result": "已保存"})

    @app.route('/reload-model', methods=['POST'])
    def reload_model():
        data = request.get_json() or {}
        device_setting = data.get('device', settings_mgr.load().get('device', 'auto'))
        settings_mgr.save({"device": device_setting})

        warning = None
        if device_setting == "gpu" and not torch.cuda.is_available():
            warning = "选择了 GPU 模式但未安装 GPU 版 PyTorch"

        threading.Thread(target=model_mgr.load, args=(device_setting,), daemon=True).start()
        return jsonify({"result": f"模型重载中，设备: {device_setting}", "warning": warning})
