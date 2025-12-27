@echo off
chcp 65001 >nul
echo ========================================
echo   B2C AI System 一键启动脚本
echo ========================================
echo.

:: 检查 node_modules 是否存在
if not exist "frontend\node_modules" (
    echo [前端] 正在安装依赖...
    cd frontend
    call npm install
    cd ..
)

if not exist "worker\node_modules" (
    echo [后端] 正在安装依赖...
    cd worker
    call npm install
    cd ..
)

echo.
echo [启动] 前端服务 (Astro) - 端口 4321
start "Frontend - Astro" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [启动] 后端服务 (Worker) - 端口 8787
start "Backend - Worker" cmd /k "cd /d %~dp0worker && npm run dev"

echo.
echo ========================================
echo   服务已启动！
echo   前端: http://localhost:4321
echo   后端: http://localhost:8787
echo ========================================
echo.
echo 按任意键关闭此窗口（服务窗口会保持运行）
pause >nul
