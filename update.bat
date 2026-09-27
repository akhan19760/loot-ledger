@echo off
rem Refresh prices from all stores and rebuild the library, then open it.
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
if not exist raw\wikidata_games.json python genres.py
python fetch.py || goto :error
python build.py || goto :error
start "" "site\index.html"
exit /b 0
:error
echo.
echo Something went wrong - see the messages above.
pause
