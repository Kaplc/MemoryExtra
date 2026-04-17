$ErrorActionPreference = 'SilentlyContinue'
Write-Host "=== Killing old processes ==="

# 读取端口配置
$portConfig = Get-Content '.port_config' -Raw
if ($portConfig) {
    $ports = $portConfig -split ','
    foreach ($p in $ports) {
        $p = $p.Trim()
        if ($p) {
            $conn = Get-NetTCPConnection -LocalPort $p -State Listen
            if ($conn) {
                Write-Host "  Killed port $p PID $($conn.OwningProcess)"
                Stop-Process -Id $conn.OwningProcess -Force
            }
        }
    }
}

# 杀掉 qdrant
Get-Process qdrant -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Killed qdrant: $($_.Id)"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "=== Done ==="
