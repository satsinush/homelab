@echo off
REM Unified deployment script for Homelab API and Frontend
REM Usage: deploy.bat [--api] [--frontend] [--all] [--user USERNAME] [--ip IP_ADDRESS] [--port PORT]
REM Default behavior without flags is to deploy all

setlocal

REM Initialize flags and default values
set DEPLOY_API=false
set DEPLOY_FRONTEND=false
set DEPLOY_ALL=false
set SSH_USER=aneedham
set SSH_IP=10.10.10.10
set SSH_PORT=2222

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
if "%~1"=="--user" (
    set SSH_USER=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--ip" (
    set SSH_IP=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--port" (
    set SSH_PORT=%~2
    shift
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
echo Target: %SSH_USER%@%SSH_IP%:%SSH_PORT%
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
    ssh -t -p %SSH_PORT% %SSH_USER%@%SSH_IP% "sudo rm -rf /srv/www/homelab-dashboard/dist && sudo mkdir -p /srv/www/homelab-dashboard && sudo chown %SSH_USER%:%SSH_USER% /srv/www/homelab-dashboard && sudo chmod 755 /srv/www/homelab-dashboard"
    if errorlevel 1 (
        echo ERROR: Failed to prepare frontend directories on server
        exit /b 1
    )
    
    echo [FRONTEND] Uploading files...
    scp -r -P %SSH_PORT% ./homelab-dashboard/dist %SSH_USER%@%SSH_IP%:/srv/www/homelab-dashboard/
    if errorlevel 1 (
        echo ERROR: Failed to upload frontend files
        exit /b 1
    )
    
    echo [FRONTEND] Setting permissions and reloading nginx...
    ssh -t -p %SSH_PORT% %SSH_USER%@%SSH_IP% "sudo chown -R http:http /srv/www/homelab-dashboard/dist/ && sudo chmod -R 755 /srv/www/homelab-dashboard/dist/ && sudo nginx -t && sudo systemctl reload nginx"
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
    ssh -t -p %SSH_PORT% %SSH_USER%@%SSH_IP% "sudo systemctl stop homelab-api.service"
    if errorlevel 1 (
        echo ERROR: Failed to stop API service
        exit /b 1
    )
    
    echo [API] Uploading files...
    scp -P %SSH_PORT% ./homelab-api/server.js %SSH_USER%@%SSH_IP%:/home/%SSH_USER%/homelab-api/
    if errorlevel 1 (
        echo ERROR: Failed to upload server.js
        exit /b 1
    )
    
    scp -P %SSH_PORT% ./homelab-api/package.json %SSH_USER%@%SSH_IP%:/home/%SSH_USER%/homelab-api/
    if errorlevel 1 (
        echo ERROR: Failed to upload package.json
        exit /b 1
    )
    
    echo [API] Uploading directories...
    scp -r -P %SSH_PORT% ./homelab-api/config %SSH_USER%@%SSH_IP%:/home/%SSH_USER%/homelab-api/
    scp -r -P %SSH_PORT% ./homelab-api/controllers %SSH_USER%@%SSH_IP%:/home/%SSH_USER%/homelab-api/
    scp -r -P %SSH_PORT% ./homelab-api/models %SSH_USER%@%SSH_IP%:/home/%SSH_USER%/homelab-api/
    scp -r -P %SSH_PORT% ./homelab-api/routes %SSH_USER%@%SSH_IP%:/home/%SSH_USER%/homelab-api/
    scp -r -P %SSH_PORT% ./homelab-api/middleware %SSH_USER%@%SSH_IP%:/home/%SSH_USER%/homelab-api/
    scp -r -P %SSH_PORT% ./homelab-api/utils %SSH_USER%@%SSH_IP%:/home/%SSH_USER%/homelab-api/
    if errorlevel 1 (
        echo ERROR: Failed to upload API directories
        exit /b 1
    )
    
    echo [API] Installing dependencies...
    ssh -t -p %SSH_PORT% %SSH_USER%@%SSH_IP% "cd /home/%SSH_USER%/homelab-api && npm install"
    if errorlevel 1 (
        echo ERROR: Failed to install npm dependencies
        exit /b 1
    )
    
    echo [API] Starting service...
    ssh -t -p %SSH_PORT% %SSH_USER%@%SSH_IP% "sudo systemctl start homelab-api.service && sudo systemctl status homelab-api.service"
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
