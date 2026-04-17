@echo off
chcp 65001 >nul
title Smart TAYORU — 起動中...
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════╗
echo  ║     Smart TAYORU  起動中...          ║
echo  ╚══════════════════════════════════════╝
echo.

:: Node.js チェック
where node >nul 2>&1
if errorlevel 1 (
    echo  [エラー] Node.js が見つかりません。
    echo.
    echo  以下のURLからインストールしてください：
    echo  https://nodejs.org/ja/
    echo.
    pause
    exit /b 1
)

echo  Node.js バージョン:
node -v
echo.

:: 依存パッケージチェック
if not exist "node_modules" (
    echo  初回セットアップ中（数分かかります）...
    npm install
    echo.
)

echo  ────────────────────────────────────────
echo  起動完了後、ブラウザで自動的に開きます。
echo  停止するには Ctrl+C を押してください。
echo  ────────────────────────────────────────
echo.

:: 3秒後にブラウザを開く
start "" cmd /c "timeout /t 4 >nul && start http://localhost:3000"

:: サーバー起動
npm run dev
pause
