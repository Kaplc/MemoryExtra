"""
启动器：在新控制台窗口中运行 start.bat
用法: python launch.py
"""
import os
import subprocess
import sys
import ctypes
from ctypes import wintypes

BAT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "start.bat")

def method_os_startfile():
    """方法1: os.startfile - 模拟双击"""
    os.startfile(BAT_PATH)
    return "os.startfile"

def method_subprocess_detached():
    """方法2: subprocess 纯后台模式（无新窗口）"""
    subprocess.Popen(
        ['cmd.exe', '/c', BAT_PATH],
        creationflags=subprocess.DETACHED_PROCESS,
        cwd=os.path.dirname(BAT_PATH),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return "subprocess.DETACHED_PROCESS (后台)"

def method_ctypes():
    """方法3: ctypes 调用 CreateProcess 创建新控制台"""
    STARTF_USESHOWWINDOW = 0x00000001
    SW_SHOW = 5
    CREATE_NEW_CONSOLE = 0x00000010
    CREATE_NO_WINDOW = 0x08000000

    startupinfo = ctypes.STARTUPINFO()
    startupinfo.cb = ctypes.sizeof(ctypes.STARTUPINFO)
    startupinfo.dwFlags = STARTF_USESHOWWINDOW
    startupinfo.wShowWindow = SW_SHOW

    proc_info = ctypes.PROCESS_INFORMATION()

    cmd_line = f'cmd.exe /c "{BAT_PATH}"'
    cmd_buf = ctypes.create_unicode_buffer(cmd_line)

    success = ctypes.windll.kernel32.CreateProcessW(
        None,
        cmd_buf,
        None, None,
        False,
        CREATE_NEW_CONSOLE,
        None,
        os.path.dirname(BAT_PATH),
        ctypes.byref(startupinfo),
        ctypes.byref(proc_info)
    )
    if success:
        ctypes.windll.kernel32.CloseHandle(proc_info.hProcess)
        ctypes.windll.kernel32.CloseHandle(proc_info.hThread)
        return "ctypes.CreateProcessW (CREATE_NEW_CONSOLE)"
    else:
        err = ctypes.GetLastError()
        raise OSError(f"CreateProcessW 失败, 错误码={err}")

def main():
    if not os.path.exists(BAT_PATH):
        print(f"错误: 找不到 {BAT_PATH}")
        sys.exit(1)

    methods = [
        ("ctypes 新窗口", method_ctypes),
        ("os.startfile", method_os_startfile),
        ("subprocess 后台", method_subprocess_detached),
    ]

    for name, fn in methods:
        try:
            result = fn()
            print(f"[成功] {name} -> {result}")
            print(f"已启动 {os.path.basename(BAT_PATH)}")
            return
        except Exception as e:
            print(f"[失败] {name}: {e}")

    print("所有方法都失败了")
    sys.exit(1)

if __name__ == '__main__':
    main()
