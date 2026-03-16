#
# A2R System Installer for Windows
# PowerShell script to set up the complete A2R stack
#

#Requires -RunAsAdministrator

param(
    [string]$InstallDir = "$env:USERPROFILE\.a2r",
    [string]$ConfigDir = "$env:LOCALAPPDATA\a2r",
    [string]$LogDir = "$env:USERPROFILE\.logs\a2r"
)

# Configuration
$CloudPort = 8080
$DesktopPort = 3010
$NativePort = 3011

# Colors
function Write-Success($message) {
    Write-Host "✓ $message" -ForegroundColor Green
}

function Write-Error($message) {
    Write-Host "✗ $message" -ForegroundColor Red
}

function Write-Info($message) {
    Write-Host "ℹ $message" -ForegroundColor Cyan
}

function Write-Warning($message) {
    Write-Host "⚠ $message" -ForegroundColor Yellow
}

function Print-Header {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Blue
    Write-Host "║          A2R System Installer                             ║" -ForegroundColor Blue
    Write-Host "║  Cloud-Native Computer Use Architecture                   ║" -ForegroundColor Blue
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Blue
    Write-Host ""
}

# Check prerequisites
function Check-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check Node.js
    try {
        $nodeVersion = node -v
        $majorVersion = [int]($nodeVersion -replace 'v', '').Split('.')[0]
        if ($majorVersion -lt 18) {
            Write-Error "Node.js 18+ required. Found: $nodeVersion"
            exit 1
        }
        Write-Success "Node.js $nodeVersion"
    } catch {
        Write-Error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    }
    
    # Check npm
    try {
        $npmVersion = npm -v
        Write-Success "npm $npmVersion"
    } catch {
        Write-Error "npm is not available"
        exit 1
    }
    
    # Check for Chrome
    $chromePaths = @(
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
    )
    
    $chromeFound = $false
    foreach ($path in $chromePaths) {
        if (Test-Path $path) {
            $chromeFound = $true
            break
        }
    }
    
    if ($chromeFound) {
        Write-Success "Google Chrome detected"
    } else {
        Write-Warning "Google Chrome not detected. Extension will need manual installation."
    }
    
    Write-Success "Prerequisites check complete"
}

# Setup directories
function Setup-Directories {
    Write-Info "Creating directories..."
    
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    New-Item -ItemType Directory -Force -Path "$ConfigDir\chrome-extension" | Out-Null
    
    Write-Success "Directories created"
}

# Install Cloud Backend
function Install-CloudBackend {
    Write-Info "Installing Cloud Backend..."
    
    Set-Location "7-apps\cloud-backend"
    
    npm install
    npm run build
    
    Set-Location "..\.."
    Write-Success "Cloud Backend installed"
}

# Install Desktop
function Install-Desktop {
    Write-Info "Installing A2R Desktop..."
    
    Set-Location "7-apps\shell\desktop"
    
    npm install
    
    # Build native host
    Set-Location "native-host"
    npm install
    Set-Location ".."
    
    Set-Location "..\..\.."
    Write-Success "A2R Desktop installed"
}

# Register native messaging host
function Register-NativeHost {
    Write-Info "Registering Native Messaging Host..."
    
    $extensionId = "com.a2r.desktop"
    $nativeHostPath = "$PWD\7-apps\shell\desktop\native-host\dist\native-host.js"
    $registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$extensionId"
    
    # Create registry key
    if (!(Test-Path $registryPath)) {
        New-Item -Path $registryPath -Force | Out-Null
    }
    
    # Create manifest
    $manifestPath = "$ConfigDir\native-host.json"
    $manifest = @{
        name = $extensionId
        description = "A2R Desktop Native Messaging Host"
        path = $nativeHostPath
        type = "stdio"
        allowed_origins = @("chrome-extension://*/")
    } | ConvertTo-Json
    
    Set-Content -Path $manifestPath -Value $manifest
    
    # Set registry value
    Set-ItemProperty -Path $registryPath -Name "(Default)" -Value $manifestPath
    
    Write-Success "Native Messaging Host registered"
}

# Install Chrome Extension
function Install-Extension {
    Write-Info "Installing Chrome Extension..."
    
    Set-Location "7-apps\chrome-extension"
    
    npm install
    npm run build
    
    # Copy to install directory
    Copy-Item -Path "dist\*" -Destination "$ConfigDir\chrome-extension" -Recurse -Force
    
    Set-Location "..\.."
    Write-Success "Chrome Extension built and copied"
    
    Write-Info "To load the extension:"
    Write-Info "  1. Open Chrome → chrome://extensions"
    Write-Info "  2. Enable 'Developer mode'"
    Write-Info "  3. Click 'Load unpacked'"
    Write-Info "  4. Select: $ConfigDir\chrome-extension"
}

# Install Thin Client
function Install-ThinClient {
    Write-Info "Installing Thin Client..."
    
    Set-Location "7-apps\thin-client"
    
    npm install
    npm run build
    
    Set-Location "..\.."
    Write-Success "Thin Client installed"
}

# Create launcher scripts
function Create-Launchers {
    Write-Info "Creating launcher scripts..."
    
    # Cloud Backend launcher
    @"
@echo off
REM Start A2R Cloud Backend

cd /d "$PWD\7-apps\cloud-backend"
set PORT=$CloudPort
set HOST=0.0.0.0

echo Starting A2R Cloud Backend on port %PORT%...
node dist\index.js
"@ | Set-Content -Path "$InstallDir\start-cloud.bat"
    
    # Desktop launcher
    @"
@echo off
REM Start A2R Desktop

cd /d "$PWD\7-apps\shell\desktop"
echo Starting A2R Desktop...
npm run dev
"@ | Set-Content -Path "$InstallDir\start-desktop.bat"
    
    # Thin Client launcher
    @"
@echo off
REM Start A2R Thin Client

cd /d "$PWD\7-apps\thin-client"
echo Starting A2R Thin Client...
npm start
"@ | Set-Content -Path "$InstallDir\start-thin-client.bat"
    
    # Full stack launcher
    @"
@echo off
REM Start all A2R components

echo ===================================
echo          Starting A2R System
echo ===================================
echo.

start "A2R Cloud Backend" "$InstallDir\start-cloud.bat"
timeout /t 2 >nul

start "A2R Desktop" "$InstallDir\start-desktop.bat"
timeout /t 3 >nul

start "A2R Thin Client" "$InstallDir\start-thin-client.bat"

echo.
echo All components started!
echo.
echo Press any key to exit this window...
pause >nul
"@ | Set-Content -Path "$InstallDir\start-all.bat"
    
    Write-Success "Launcher scripts created"
}

# Create configuration
function Create-Config {
    Write-Info "Creating configuration..."
    
    $config = @{
        version = "1.0.0"
        installed_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        components = @{
            cloud_backend = @{
                enabled = $true
                port = $CloudPort
                host = "0.0.0.0"
            }
            desktop = @{
                enabled = $true
                port = $DesktopPort
                cowork_enabled = $true
            }
            thin_client = @{
                backend = "cloud"
                cloud_url = "ws://localhost:$CloudPort/ws/extension"
                desktop_port = $DesktopPort
            }
            extension = @{
                mode = "cloud"
                cloud_url = "ws://localhost:$CloudPort/ws/extension"
                desktop_native_port = $NativePort
            }
        }
    } | ConvertTo-Json -Depth 4
    
    Set-Content -Path "$ConfigDir\config.json" -Value $config
    Write-Success "Configuration saved"
}

# Print summary
function Print-Summary {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║          Installation Complete!                           ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "Installation directory: $InstallDir"
    Write-Host "Configuration: $ConfigDir"
    Write-Host "Logs: $LogDir"
    Write-Host ""
    Write-Host "Quick Start:"
    Write-Host "  1. Start Cloud Backend:  $InstallDir\start-cloud.bat"
    Write-Host "  2. Start Desktop:         $InstallDir\start-desktop.bat"
    Write-Host "  3. Load Chrome Extension: chrome://extensions → Load unpacked"
    Write-Host "     Location: $ConfigDir\chrome-extension"
    Write-Host "  4. Start Thin Client:     $InstallDir\start-thin-client.bat"
    Write-Host ""
    Write-Host "Or start everything at once:"
    Write-Host "  $InstallDir\start-all.bat"
    Write-Host ""
    Write-Host "Ports:"
    Write-Host "  - Cloud Backend:    $CloudPort"
    Write-Host "  - Desktop Cowork:   $DesktopPort"
    Write-Host "  - Native Messaging: $NativePort"
    Write-Host ""
    Write-Warning "Don't forget to load the Chrome Extension!"
    Write-Host ""
}

# Main installation
function Main {
    Print-Header
    
    # Check if running from correct directory
    if (!(Test-Path "7-apps")) {
        Write-Error "Please run this script from the project root directory"
        exit 1
    }
    
    Check-Prerequisites
    Setup-Directories
    Install-CloudBackend
    Install-Desktop
    Register-NativeHost
    Install-Extension
    Install-ThinClient
    Create-Launchers
    Create-Config
    
    Print-Summary
}

# Run main
Main
