#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Allternit Node Agent Windows Service Installer

.DESCRIPTION
    Installs and configures the Allternit Node Agent as a Windows Service.
    Requires Docker Desktop for Windows to be installed.

.PARAMETER Token
    Your Allternit node authentication token (required)

.PARAMETER NodeId
    Custom node ID (optional, auto-generated if not provided)

.PARAMETER ControlPlane
    Control plane URL (default: wss://control.allternit.io)

.PARAMETER InstallDir
    Installation directory (default: C:\Program Files\allternit)

.PARAMETER Uninstall
    Remove the Allternit Node Agent service

.EXAMPLE
    .\install-windows.ps1 -Token "allternit_xxxxxxxxxxxxx"

.EXAMPLE
    .\install-windows.ps1 -Token "allternit_xxx" -NodeId "my-node-1"

.EXAMPLE
    .\install-windows.ps1 -Uninstall
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, ParameterSetName = "Install")]
    [string]$Token,
    
    [Parameter(ParameterSetName = "Install")]
    [string]$NodeId,
    
    [Parameter(ParameterSetName = "Install")]
    [string]$ControlPlane = "wss://control.allternit.io",
    
    [Parameter(ParameterSetName = "Install")]
    [string]$InstallDir = "C:\Program Files\allternit",
    
    [Parameter(ParameterSetName = "Uninstall")]
    [switch]$Uninstall
)

# Configuration
$ServiceName = "allternit-node"
$ServiceDisplayName = "Allternit Node Agent"
$ServiceDescription = "Allternit Node Agent - Connect your infrastructure to Allternit Control Plane"
$ConfigDir = "C:\ProgramData\allternit"
$LogDir = "C:\ProgramData\allternit\logs"

# Colors
function Write-Info { Write-Host "→ $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "✓ $args" -ForegroundColor Green }
function Write-Warn { Write-Host "⚠ $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "✗ $args" -ForegroundColor Red }

#------------------------------------------------------------------------------
# Helper Functions
#------------------------------------------------------------------------------

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-DockerInstalled {
    try {
        $dockerVersion = docker --version 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Test-DockerRunning {
    try {
        docker ps 2>&1 | Out-Null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Get-RandomString {
    param([int]$Length = 12)
    $chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    return -join ((Get-Random -Count $Length -InputObject $chars.ToCharArray()))
}

function Write-Banner {
    Write-Host ""
    Write-Host "    ___    __  ______" -ForegroundColor Cyan
    Write-Host "   /   |  /  |/  /   |  _    __" -ForegroundColor Cyan
    Write-Host "  / /| | / /|_/ / /| | | |  / /" -ForegroundColor Cyan
    Write-Host " / ___ |/ /  / / ___ | | | / /" -ForegroundColor Cyan
    Write-Host "/_/  |_/_/  /_/_/  |_| |___/_/" -ForegroundColor Cyan
    Write-Host "                      Node Agent" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Installing Allternit Node Agent for Windows..." -ForegroundColor Cyan
    Write-Host ""
}

#------------------------------------------------------------------------------
# Installation Functions
#------------------------------------------------------------------------------

function Install-AllternitService {
    Write-Info "Installing Allternit Node Agent service..."
    
    # Check prerequisites
    if (-not (Test-Administrator)) {
        Write-Error "This script must be run as Administrator"
        Write-Host "Right-click PowerShell and select 'Run as Administrator'"
        exit 1
    }
    
    # Check Docker
    if (-not (Test-DockerInstalled)) {
        Write-Warn "Docker Desktop not found"
        Write-Host ""
        Write-Host "Please install Docker Desktop for Windows:"
        Write-Host "https://docs.docker.com/desktop/install/windows-install/"
        Write-Host ""
        $response = Read-Host "Continue anyway? (y/n)"
        if ($response -ne 'y') {
            exit 1
        }
    } elseif (-not (Test-DockerRunning)) {
        Write-Warn "Docker is installed but not running"
        Write-Host "Starting Docker..."
        Start-Process "Docker Desktop" -WindowStyle Hidden
        Start-Sleep -Seconds 10
    } else {
        Write-Success "Docker is installed and running"
    }
    
    # Create directories
    Write-Info "Creating directories..."
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    if (-not (Test-Path $ConfigDir)) {
        New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    }
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
    Write-Success "Directories created"
    
    # Download binary
    Write-Info "Downloading Allternit Node Agent..."
    $arch = if ([Environment]::Is64BitOperatingSystem) { "x86_64" } else { "i686" }
    $downloadUrl = "https://github.com/allternit/node/releases/latest/download/allternit-node-windows-${arch}.exe"
    $binaryPath = "$InstallDir\allternit-node.exe"
    
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $binaryPath -UseBasicParsing
        Write-Success "Binary downloaded to $binaryPath"
    } catch {
        Write-Error "Failed to download binary: $_"
        Write-Warn "You can manually download from: $downloadUrl"
        exit 1
    }
    
    # Generate node ID if not provided
    if (-not $NodeId) {
        $NodeId = "node-$(Get-RandomString)"
        Write-Info "Generated node ID: $NodeId"
    }
    
    # Create configuration
    Write-Info "Creating configuration..."
    $configContent = @"
# Allternit Node Agent Configuration
# Generated: $(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")

Allternit_NODE_ID=$NodeId
ALLTERNIT_TOKEN=$Token
Allternit_CONTROL_PLANE=$ControlPlane
"@
    
    $configPath = "$ConfigDir\node.env"
    $configContent | Out-File -FilePath $configPath -Encoding UTF8
    Write-Success "Configuration saved to $configPath"
    
    # Create Windows service using sc.exe
    Write-Info "Creating Windows service..."
    $binaryPathEscaped = $binaryPath -replace '\\', '\\'
    $servicePath = "binPath= `"$binaryPath`""
    
    try {
        sc.exe create $ServiceName $servicePath start= auto DisplayName= "$ServiceDisplayName" | Out-Null
        
        # Set service description
        sc.exe description $ServiceName "$ServiceDescription" | Out-Null
        
        # Configure service recovery
        sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null
        
        Write-Success "Windows service created"
    } catch {
        Write-Error "Failed to create service: $_"
        exit 1
    }
    
    # Set service to start automatically
    try {
        Set-Service -Name $ServiceName -StartupType Automatic
        Write-Success "Service configured for automatic start"
    } catch {
        Write-Warn "Failed to configure automatic start: $_"
    }
    
    # Start service
    Write-Info "Starting Allternit Node Agent service..."
    try {
        Start-Service -Name $ServiceName
        Start-Sleep -Seconds 3
        
        $serviceStatus = Get-Service -Name $ServiceName
        if ($serviceStatus.Status -eq 'Running') {
            Write-Success "Allternit Node Agent is running"
        } else {
            Write-Warn "Service started but status is: $($serviceStatus.Status)"
        }
    } catch {
        Write-Error "Failed to start service: $_"
        Write-Host "Check Windows Event Viewer for details"
        exit 1
    }
    
    # Print summary
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✓ Installation Complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Node Details:"
    Write-Host "  Node ID:      $NodeId"
    Write-Host "  Version:      latest"
    Write-Host "  Architecture: $arch"
    Write-Host ""
    Write-Host "Installation Paths:"
    Write-Host "  Binary:  $binaryPath"
    Write-Host "  Config:  $configPath"
    Write-Host "  Logs:    $LogDir"
    Write-Host "  Service: $ServiceName"
    Write-Host ""
    Write-Host "Useful Commands:"
    Write-Host "  # Check status"
    Write-Host "  Get-Service $ServiceName"
    Write-Host ""
    Write-Host "  # View logs (Event Viewer)"
    Write-Host "  Get-EventLog -LogName Application -Source $ServiceName -Newest 50"
    Write-Host ""
    Write-Host "  # Restart service"
    Write-Host "  Restart-Service $ServiceName"
    Write-Host ""
    Write-Host "  # Stop service"
    Write-Host "  Stop-Service $ServiceName"
    Write-Host ""
    Write-Host "Next Steps:"
    Write-Host "  1. Visit https://app.allternit.io to see your node"
    Write-Host "  2. Node should appear online within 30 seconds"
    Write-Host "  3. Start deploying agents and running jobs"
    Write-Host ""
    Write-Host "Support:"
    Write-Host "  Documentation: https://docs.allternit.io"
    Write-Host "  Discord:       https://discord.gg/allternit"
    Write-Host "  GitHub:        https://github.com/allternit/node"
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
}

function Uninstall-AllternitService {
    Write-Info "Uninstalling Allternit Node Agent..."
    
    # Stop service
    Write-Info "Stopping service..."
    try {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        Write-Success "Service stopped"
    } catch {
        Write-Warn "Service was not running"
    }
    
    # Remove service
    Write-Info "Removing service..."
    try {
        sc.exe delete $ServiceName | Out-Null
        Write-Success "Service removed"
    } catch {
        Write-Warn "Service not found"
    }
    
    # Remove directories
    Write-Info "Removing installation files..."
    try {
        if (Test-Path $InstallDir) {
            Remove-Item -Path $InstallDir -Recurse -Force
            Write-Success "Removed $InstallDir"
        }
        if (Test-Path $ConfigDir) {
            Remove-Item -Path $ConfigDir -Recurse -Force
            Write-Success "Removed $ConfigDir"
        }
    } catch {
        Write-Warn "Some files could not be removed"
    }
    
    Write-Host ""
    Write-Success "Uninstallation complete"
    Write-Host ""
}

#------------------------------------------------------------------------------
# Main
#------------------------------------------------------------------------------

Write-Banner

if ($Uninstall) {
    Uninstall-AllternitService
} else {
    Install-AllternitService
}
