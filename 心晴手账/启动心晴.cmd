@echo off
setlocal
cd /d "%~dp0"
set "TIANQING_NODE=node.exe"
if exist "%ProgramFiles%\nodejs\node.exe" set "TIANQING_NODE=%ProgramFiles%\nodejs\node.exe"
"%TIANQING_NODE%" "%~dp0desktop-launch.js"
if errorlevel 1 (
  echo.
  echo TianQing could not start. Please keep this window open and share the error above.
  echo Node.js 20 or newer is required.
  pause
  exit /b 1
)
endlocal
