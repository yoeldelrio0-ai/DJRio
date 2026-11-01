@echo off
rem Double-click on Windows to open the DJ Rio site on http://localhost:5287
cd /d "%~dp0"
where py >nul 2>nul && (py -3 serve.py) || (python serve.py)
pause
