@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1 && (set PY=py) || (set PY=python)
%PY% -m pip install --quiet --disable-pip-version-check -r requirements.txt
%PY% -m ct6339.app
pause
