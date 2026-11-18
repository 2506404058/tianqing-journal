@echo off
setlocal
chcp 65001 >nul
title Project Start Center
cd /d "%~dp0"
set "PROJECT_NODE=node.exe"
if exist "%ProgramFiles%\nodejs\node.exe" set "PROJECT_NODE=%ProgramFiles%\nodejs\node.exe"
"%PROJECT_NODE%" "%~dp0launcher.cjs"
if errorlevel 1 pause
