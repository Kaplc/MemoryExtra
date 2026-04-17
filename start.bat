@echo off
setlocal enabledelayedexpansion

echo === Memory Manager ===

:: ── 单例：检测旧实例并清理 ────────────────────────────
echo === Checking for existing instance ===
"venv312\Scripts\python.exe" "backend\_boot_helper.py" kill 2>NUL

:: ── 检查依赖 ──────────────────────────────────────────
echo === Checking Dependencies ===
"venv312\Scripts\python.exe" -c "import flask, webview, qdrant_client, psutil" 2>NUL
if %ERRORLEVEL% neq 0 (
    echo Missing dependencies, installing...
    "venv312\Scripts\pip.exe" install -r "backend\requirements.txt"
    if %ERRORLEVEL% neq 0 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: ── 获取端口（首次自动分配，后续读配置文件）───────────
echo === Getting ports ===
"venv312\Scripts\python.exe" "backend\_boot_helper.py" ports > "%TEMP%\mem_ports.txt" 2>&1
set /p PORT_RESULT=<"%TEMP%\mem_ports.txt"

:: 去掉可能的额外输出行，只取第一行逗号分隔的数字
for /f "tokens=1,2,3 delims=," %%a in ("%PORT_RESULT%") do (
    set "FLASK_PORT=%%a"
    set "QDRANT_HTTP=%%b"
    set "QDRANT_GRPC=%%c"
)

echo   Flask Port : %FLASK_PORT%
echo   Qdrant HTTP: %QDRANT_HTTP%
echo   Qdrant gRPC: %QDRANT_GRPC%

:: ── 生成 Qdrant 配置 ───────────────────────────────────
(
echo service:
echo   host: 0.0.0.0
echo   http_port: %QDRANT_HTTP%
echo   grpc_port: %QDRANT_GRPC%
echo.
echo storage:
echo   storage_path: ./storage
) > "backend\qdrant\config\config.yaml"

:: ── 启动 Qdrant ─────────────────────────────────────────
echo === Starting Qdrant ===
netstat -ano 2>NUL | findstr ":%QDRANT_HTTP%.*LISTENING" >NUL
if %ERRORLEVEL% == 0 (
    echo Qdrant already running on port %QDRANT_HTTP%.
) else (
    start "" /MIN "backend\qdrant\qdrant.exe"
    echo Qdrant started on port %QDRANT_HTTP%.
    timeout /t 2 >NUL
)

:: ── 启动应用 ──────────────────────────────────────────
echo === Starting Memory Manager ===
set "PYTHONPATH=%~dp0;%~dp0backend"
set "FLASK_PORT=%FLASK_PORT%"
set "QDRANT_HTTP_PORT=%QDRANT_HTTP%"
set "QDRANT_GRPC_PORT=%QDRANT_GRPC%"
"venv312\Scripts\python.exe" "backend\app.py"
