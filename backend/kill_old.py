"""快速杀掉占用项目端口的旧进程（替代慢速的 PowerShell kill_ports.ps1）"""
import os
import sys
import subprocess
import time

def main():
    # 读取端口配置
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.port_config')
    try:
        with open(config_path, 'r') as f:
            raw = f.read().strip()
        ports = [int(p.strip()) for p in raw.split(',') if p.strip().isdigit()]
    except (FileNotFoundError, ValueError):
        ports = []

    if not ports:
        return  # 无配置，跳过

    print("=== Killing old processes ===")

    # 单次 netstat 获取所有监听端口 → PID 映射（比 Get-NetTCPConnection 快 10 倍+）
    try:
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True, text=True, timeout=10
        )
    except Exception as e:
        print(f"  [warn] netstat failed: {e}")
        return

    port_to_pid = {}
    for line in result.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[0] == 'TCP' and 'LISTENING' in line:
            addr = parts[1]
            pid = int(parts[-1])
            # 提取端口号 (格式: 0.0.0.0:18980 或 [::]:18980)
            if ':' in addr:
                port_str = addr.rsplit(':', 1)[-1]
                try:
                    port = int(port_str)
                    port_to_pid[port] = pid
                except ValueError:
                    pass

    killed_pids = set()
    target_ports = set(ports)

    # 1. 杀掉占用目标端口的进程
    for port in target_ports:
        pid = port_to_pid.get(port)
        if pid and pid not in killed_pids:
            try:
                os.kill(pid, 9)  # SIGKILL
                killed_pids.add(pid)
                print(f"  Killed port {port} (PID {pid})")
            except ProcessLookupError:
                pass  # 进程已不存在
            except PermissionError:
                print(f"  No permission to kill PID {pid} (port {port})")
            except Exception as e:
                print(f"  Failed to kill PID {pid}: {e}")

    # 2. 额外：杀掉本项目目录下的残留 qdrant.exe（无论在哪个端口）
    _project_root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    try:
        result = subprocess.run(
            ['wmic', 'process', 'where', f"name='qdrant.exe'", 'get', 'ProcessId,ExecutablePath', '/format:csv'],
            capture_output=True, text=True, timeout=10
        )
        for line in result.stdout.splitlines():
            parts = [p.strip() for p in line.split(',') if p.strip()]
            if len(parts) >= 2 and parts[0].lower().endswith('qdrant.exe'):
                exe_path = parts[0]
                pid_str = parts[1]
                # 只杀本项目目录下的 qdrant.exe
                if _project_root.lower() in exe_path.lower():
                    try:
                        pid = int(pid_str)
                        if pid not in killed_pids:
                            os.kill(pid, 9)
                            killed_pids.add(pid)
                            print(f"  Killed stale qdrant.exe PID {pid} ({exe_path})")
                    except (ValueError, ProcessLookupError, PermissionError):
                        pass
    except Exception as e:
        print(f"  [warn] wmic check skipped: {e}")

    # 3. 兜底：杀掉占用 Qdrant 目标端口的进程（如果上面还没覆盖到）
    if len(ports) >= 3:
        for port in ports[1:3]:
            pid = port_to_pid.get(port)
            if pid and pid not in killed_pids:
                try:
                    os.kill(pid, 9)
                    killed_pids.add(pid)
                    print(f"  Killed port {port} (PID {pid})")
                except (ProcessLookupError, PermissionError):
                    pass

    print("=== Done ===")


if __name__ == '__main__':
    main()
