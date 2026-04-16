"""设置文件管理"""
import json
import os


class SettingsManager:
    def __init__(self, settings_file):
        self._file = settings_file

    def load(self) -> dict:
        try:
            with open(self._file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {"device": "cpu"}

    def save(self, data: dict):
        current = self.load()
        current.update(data)
        with open(self._file, 'w', encoding='utf-8') as f:
            json.dump(current, f, indent=2, ensure_ascii=False)


def resolve_device(setting: str) -> str:
    """根据设置解析实际 device 字符串"""
    import torch
    force_cpu = os.environ.get('FORCE_CPU', '0') == '1'
    if force_cpu:
        return "cpu"
    if setting == "gpu":
        return "cuda" if torch.cuda.is_available() else "cpu"
    elif setting == "cpu":
        return "cpu"
    else:  # auto
        return "cuda" if torch.cuda.is_available() else "cpu"
