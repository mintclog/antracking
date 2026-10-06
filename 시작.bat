@echo off
setlocal
title ANT TRACKER Server
pushd "%~dp0"
if errorlevel 1 goto folder_error

where node.exe >nul 2>&1
if errorlevel 1 goto node_error
where npm.cmd >nul 2>&1
if errorlevel 1 goto node_error

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing dependencies. Internet access is required...
  call npm.cmd install
  if errorlevel 1 goto install_error
)

echo Starting ANT TRACKER and opening your browser...
echo Keep this window open. Press Ctrl+C to stop the server.
call npm.cmd run dev -- --host 127.0.0.1 --open
if errorlevel 1 (
  echo Server startup failed. Check the error above.
  pause
)
popd
exit /b

:node_error
echo Node.js or npm was not found. Install Node.js, then reopen this file.
goto failure

:install_error
echo Dependency installation failed. Check the error above.
goto failure

:folder_error
echo Cannot open the project folder.
pause
exit /b 1

:failure
pause
popd
exit /b 1
