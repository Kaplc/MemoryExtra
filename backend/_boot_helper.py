"""启动辅助：端口管理（首次分配+读取配置+杀旧实例）"""
import socket
import os
import sys
import subprocess


def is_port_free(port):
    """检查端口是否空闲（TCP）"""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind(('127.0.0.1', port))
        s.close()
        return True
    except OSError:
        s.close()
        return False


def find_free_ports():
    """从基础端口递增，找到一组可用的 Flask+Qdrant 端口"""
    base_f, base_h, base_g = 18765, 6333, 6334
    for offset in range(100):
        f, h, g = base_f + offset, base_h + offset * 2, base_g + offset * 2
        if is_port_free(f) and is_port_free(h) and is_port_free(g):
            return {"flask": f, "http": h, "grpc": g}
    raise RuntimeError("无法找到可用端口")


def get_ports():
    """返回端口字典：优先读 .port_config，否则分配并保存"""
    config_path = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '.port_config'))

    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                line = f.read().strip()
            parts = line.split(',')
            if len(parts) >= 3:
                return {"flask": int(parts[0]), "http": int(parts[1]), "grpc": int(parts[2])}
        except Exception:
            pass

    # 首次：分配并保存
    ports = find_free_ports()
    try:
        with open(config_path, 'w') as f:
            f.write(f"{ports['flask']},{ports['http']},{ports['grpc']}")
    except Exception:
        pass
    return ports


def kill_old_instance():
    """检测并清理旧实例"""
    port_file = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '.port'))
    old_port = None

    if os.path.exists(port_file):
        try:
            with open(port_file, 'r') as f:
                old_port = int(f.read().strip())
        except Exception:
            pass

    if old_port:
        import urllib.request
        try:
            urllib.request.urlopen(f'http://127.0.0.1:{old_port}/health', timeout=2)
            # 实例存活，杀掉
            result = subprocess.run(
                ['netstat', '-ano'], capture_output=True, text=True, timeout=5
            )
            for line in result.stdout.splitlines():
                if f':{old_port}' in line and 'LISTENING' in line:
                    pid = line.strip().split()[-1]
                    subprocess.run(['taskkill', '/F', '/PID', pid],
                                   capture_output=True, timeout=5)
                    print(f'KILLED:{old_port}:{pid}')
                    return True
        except Exception:
            pass
    return False


if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else ''
    if action == 'ports':
        p = get_ports()
        print(f"{p['flask']},{p['http']},{p['grpc']}")
    elif action == 'kill':
        kill_old_instance()
