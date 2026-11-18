@echo off
setlocal
chcp 65001 >nul
title TianQing Journal - Connection Check
cd /d "%~dp0"
set "TIANQING_SERVER_HOME=%~dp0"
set "TIANQING_ACCOUNTS_DIR=%~dp0data\accounts"
set "TIANQING_DATA_DIR=%~dp0data\desktop"
set "TEMP=%~dp0temp"
set "TMP=%~dp0temp"
set "TMPDIR=%~dp0temp"
set "NODE_COMPILE_CACHE=%~dp0cache\node"
set "NPM_CONFIG_CACHE=%~dp0cache\npm"
if not exist "%TEMP%" mkdir "%TEMP%"
set "TIANQING_NODE=node.exe"
if exist "%ProgramFiles%\nodejs\node.exe" set "TIANQING_NODE=%ProgramFiles%\nodejs\node.exe"
set "TIANQING_PROJECT=%~dp0心晴手账"
if defined TIANQING_SITE_DIR set "TIANQING_PROJECT=%TIANQING_SITE_DIR%"
if not defined TIANQING_SHARE_PORT set "TIANQING_SHARE_PORT=3000"
"%TIANQING_NODE%" "%TIANQING_PROJECT%\doctor.js"
set "TIANQING_RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %TIANQING_RESULT%
