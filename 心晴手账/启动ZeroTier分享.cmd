@echo off
setlocal
chcp 65001 >nul
title TianQing Journal - ZeroTier
mode con cols=112 lines=38 >nul 2>&1
cd /d "%~dp0"
set "TIANQING_NODE=node.exe"
if exist "%ProgramFiles%\nodejs\node.exe" set "TIANQING_NODE=%ProgramFiles%\nodejs\node.exe"
"%TIANQING_NODE%" "%~dp0share-server.js"
set "TIANQING_RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %TIANQING_RESULT%
