@echo off
setlocal
chcp 65001 >nul
title Site Manager - Local Admin
cd /d "%~dp0"
set "SITE_MANAGER_HOME=%~dp0"
set "SITE_MANAGER_PORT=3190"
set "TEMP=%~dp0temp"
set "TMP=%TEMP%"
set "TMPDIR=%TEMP%"
set "NODE_COMPILE_CACHE=%~dp0cache\node"
set "NPM_CONFIG_CACHE=%~dp0cache\npm"
if not exist "%TEMP%" mkdir "%TEMP%"
set "MANAGER_NODE=node.exe"
if exist "%ProgramFiles%\nodejs\node.exe" set "MANAGER_NODE=%ProgramFiles%\nodejs\node.exe"
"%MANAGER_NODE%" "%~dp0site-manager\launch.js"
set "MANAGER_RESULT=%ERRORLEVEL%"
if not "%MANAGER_RESULT%"=="0" pause
exit /b %MANAGER_RESULT%
