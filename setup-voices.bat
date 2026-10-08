@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 voice\setup.py
) else (
  python voice\setup.py
)
if errorlevel 1 echo Install Python 3.10 or later, then run this script again.
pause
