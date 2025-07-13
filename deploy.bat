@echo off
REM Unified deployment script for Homelab API and Frontend
REM Usage: deploy.bat [--api] [--frontend] [--all]
REM Default behavior without flags is to deploy all

setlocal

REM Initialize flags
set DEPLOY_API=false
set DEPLOY_FRONTEND=false
set DEPLOY_ALL=false

REM Parse command line arguments
:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="--api" (
    set DEPLOY_API=true
    shift
    goto parse_args
)
if "%~1"=="--frontend" (
    set DEPLOY_FRONTEND=true
    shift
    goto parse_args
)
if "%~1"=="--all" (
    set DEPLOY_ALL=true
    shift
    goto parse_args
)
shift
goto parse_args
:end_parse

REM If no flags specified, deploy all
if "%DEPLOY_API%"=="false" if "%DEPLOY_FRONTEND%"=="false" if "%DEPLOY_ALL%"=="false" (
    set DEPLOY_ALL=true
)

REM If --all flag is used, enable both
if "%DEPLOY_ALL%"=="true" (
    set DEPLOY_API=true
    set DEPLOY_FRONTEND=true
)

echo ================================================
echo Homelab Deployment Script
echo ================================================
echo API: %DEPLOY_API%
echo Frontend: %DEPLOY_FRONTEND%
echo ================================================

REM Deploy Frontend
if "%DEPLOY_FRONTEND%"=="true" (
    echo.
    echo [FRONTEND] Building React application...
    cd homelab-dashboard
    if errorlevel 1 (
        echo ERROR: Failed to navigate to homelab-dashboard directory
        exit /b 1
    )
    
    call npm run build
    if errorlevel 1 (
        echo ERROR: Frontend build failed
        exit /b 1
    )
    
    cd ..
    echo [FRONTEND] Build completed successfully
    
    echo [FRONTEND] Preparing directories...
    ssh -t -p 2222 aneedham@10.10.10.10 "sudo rm -rf /srv/www/homelab-dashboard/dist && sudo mkdir -p /srv/www/homelab-dashboard && sudo chown aneedham:aneedham /srv/www/homelab-dashboard && sudo chmod 755 /srv/www/homelab-dashboard"
    if errorlevel 1 (
        echo ERROR: Failed to prepare frontend directories on server
        exit /b 1
    )
    
    echo [FRONTEND] Uploading files...
    scp -r -P 2222 ./homelab-dashboard/dist aneedham@10.10.10.10:/srv/www/homelab-dashboard/
    if errorlevel 1 (
        echo ERROR: Failed to upload frontend files
        exit /b 1
    )
    
    echo [FRONTEND] Setting permissions and reloading nginx...
    ssh -t -p 2222 aneedham@10.10.10.10 "sudo chown -R http:http /srv/www/homelab-dashboard/dist/ && sudo chmod -R 755 /srv/www/homelab-dashboard/dist/ && sudo nginx -t && sudo systemctl reload nginx"
    if errorlevel 1 (
        echo ERROR: Failed to set permissions or reload nginx
        exit /b 1
    )
    echo [FRONTEND] Deployment completed successfully
)

REM Deploy API
if "%DEPLOY_API%"=="true" (
    echo.
    echo [API] Stopping API service...
    ssh -t -p 2222 aneedham@10.10.10.10 "sudo systemctl stop homelab-api.service"
    if errorlevel 1 (
        echo ERROR: Failed to stop API service
        exit /b 1
    )
    
    echo [API] Uploading files...
    scp -P 2222 ./homelab-api/server.js aneedham@10.10.10.10:/home/aneedham/homelab-api/
    if errorlevel 1 (
        echo ERROR: Failed to upload server.js
        exit /b 1
    )
    
    scp -P 2222 ./homelab-api/package.json aneedham@10.10.10.10:/home/aneedham/homelab-api/
    if errorlevel 1 (
        echo ERROR: Failed to upload package.json
        exit /b 1
    )
    
    echo [API] Uploading directories...
    scp -r -P 2222 ./homelab-api/config aneedham@10.10.10.10:/home/aneedham/homelab-api/
    scp -r -P 2222 ./homelab-api/controllers aneedham@10.10.10.10:/home/aneedham/homelab-api/
    scp -r -P 2222 ./homelab-api/models aneedham@10.10.10.10:/home/aneedham/homelab-api/
    scp -r -P 2222 ./homelab-api/routes aneedham@10.10.10.10:/home/aneedham/homelab-api/
    scp -r -P 2222 ./homelab-api/middleware aneedham@10.10.10.10:/home/aneedham/homelab-api/
    scp -r -P 2222 ./homelab-api/utils aneedham@10.10.10.10:/home/aneedham/homelab-api/
    if errorlevel 1 (
        echo ERROR: Failed to upload API directories
        exit /b 1
    )
    
    echo [API] Installing dependencies...
    ssh -t -p 2222 aneedham@10.10.10.10 "cd /home/aneedham/homelab-api && npm install"
    if errorlevel 1 (
        echo ERROR: Failed to install npm dependencies
        exit /b 1
    )
    
    echo [API] Starting service...
    ssh -t -p 2222 aneedham@10.10.10.10 "sudo systemctl start homelab-api.service && sudo systemctl status homelab-api.service"
    if errorlevel 1 (
        echo ERROR: Failed to start API service
        exit /b 1
    )
    echo [API] Deployment completed successfully
)

echo.
echo ================================================
echo Deployment completed successfully!
echo ================================================

endlocal
