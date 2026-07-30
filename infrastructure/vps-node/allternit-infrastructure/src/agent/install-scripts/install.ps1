#
# Allternit Node Agent Installation Script for Windows
# Supports: Windows Server 2019/2022, Windows 10/11
#
# This script:
# - Detects Windows version and architecture
# - Installs Docker Desktop if not present
# - Pulls Allternit agent Docker image
# - Sets up Windows service
# - Configures networking
# - Sets up log rotation
#

[CmdletBinding()]
param(
    [string]$Version = "latest",
    [string]$InstallDir = "C:\ProgramData\Allternit",
    [string]$ConfigDir = "C:\ProgramData\Allternit\Config",
    [string]$LogDir = "C:\ProgramData\Allternit\Logs",
    [switch]$SkipDockerInstall,
    [switch]$Force
)

# Error handling
$ErrorActionPreference = "Stop"

# Logging functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Global variables
$script:AllternitVersion = $Version
$script:AllternitDir = $InstallDir
$script:AllternitConfigDir = $ConfigDir
$script:AllternitLogDir = $LogDir
$script:ServiceName = "AllternitAgent"

# Check if running as administrator
function Test-Administrator {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Get Windows version info
function Get-WindowsInfo {
    Write-Info "Detecting Windows version..."
    
    $osInfo = Get-CimInstance -ClassName Win32_OperatingSystem
    $osVersion = [System.Environment]::OSVersion.Version
    
    $script:WindowsVersion = $osInfo.Caption
    $script:WindowsBuild = $osInfo.BuildNumber
    $script:IsServer = $osInfo.ProductType -eq 3
    $script:Architecture = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "386" }
    
    Write-Info "Windows Version: $script:WindowsVersion"
    Write-Info "Build: $script:WindowsBuild"
    Write-Info "Architecture: $script:Architecture"
    Write-Info "Server OS: $script:IsServer"
    
    # Check if Windows version is supported
    if ($osVersion.Major -lt 10) {
        throw "Windows 10 or Server 2019+ is required"
    }
}

# Check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check if running as admin
    if (-not (Test-Administrator)) {
        throw "This script must be run as Administrator"
    }
    
    # Check PowerShell version
    if ($PSVersionTable.PSVersion.Major -lt 5) {
        throw "PowerShell 5.0 or higher is required"
    }
    
    # Check available memory (minimum 2GB)
    $totalMemory = (Get-CimInstance -ClassName Win32_ComputerSystem).TotalPhysicalMemory / 1GB
    if ($totalMemory -lt 2) {
        Write-Warn "Low memory detected: $([math]::Round($totalMemory, 2))GB (recommended: 4GB+)"
    }
    
    # Check available disk space (minimum 10GB)
    $systemDrive = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='$env:SystemDrive'"
    $freeSpaceGB = [math]::Round($systemDrive.FreeSpace / 1GB, 2)
    if ($freeSpaceGB -lt 10) {
        Write-Warn "Low disk space: $freeSpaceGB GB available (recommended: 20GB+)"
    }
    
    Write-Success "Prerequisites check passed"
}

# Install Docker
function Install-Docker {
    if ($SkipDockerInstall) {
        Write-Info "Skipping Docker installation"
        return
    }
    
    Write-Info "Checking Docker installation..."
    
    # Check if Docker is already installed
    $dockerInstalled = $false
    try {
        $dockerVersion = docker version --format '{{.Server.Version}}' 2>$null
        if ($dockerVersion) {
            Write-Info "Docker already installed: $dockerVersion"
            $dockerInstalled = $true
        }
    } catch {
        $dockerInstalled = $false
    }
    
    if ($dockerInstalled) {
        return
    }
    
    Write-Info "Installing Docker..."
    
    # For Windows Server, use DockerMsftProvider
    if ($script:IsServer) {
        Install-DockerWindowsServer
    } else {
        # For Windows 10/11, Docker Desktop is required
        Install-DockerDesktop
    }
}

function Install-DockerWindowsServer {
    Write-Info "Installing Docker for Windows Server..."
    
    # Install NuGet provider if needed
    if (-not (Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue)) {
        Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force | Out-Null
    }
    
    # Install DockerMsftProvider
    if (-not (Get-Module -ListAvailable -Name DockerMsftProvider)) {
        Install-Module -Name DockerMsftProvider -Force | Out-Null
    }
    
    # Install Docker
    Install-Package -Name docker -ProviderName DockerMsftProvider -Force | Out-Null
    
    # Start Docker service
    Start-Service docker
    
    Write-Success "Docker installed successfully"
}

function Install-DockerDesktop {
    Write-Info "Docker Desktop is required for Windows 10/11"
    Write-Info "Please download and install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    Write-Info "After installation, ensure 'Use the WSL 2 based engine' is enabled"
    
    $response = Read-Host "Would you like to open the download page? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Start-Process "https://www.docker.com/products/docker-desktop"
    }
    
    throw "Please install Docker Desktop manually and re-run this script"
}

# Setup directories
function Initialize-Directories {
    Write-Info "Setting up Allternit directories..."
    
    $directories = @(
        $script:AllternitDir,
        "$script:AllternitDir\config",
        "$script:AllternitDir\data",
        "$script:AllternitDir\scripts",
        $script:AllternitConfigDir,
        $script:AllternitLogDir
    )
    
    foreach ($dir in $directories) {
        if (-not (Test-Path -Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Info "Created: $dir"
        }
    }
    
    # Set ACLs
    $acl = Get-Acl $script:AllternitDir
    
    # Add SYSTEM full control
    $systemRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        "SYSTEM",
        "FullControl",
        "ContainerInherit,ObjectInherit",
        "None",
        "Allow"
    )
    $acl.SetAccessRule($systemRule)
    Set-Acl $script:AllternitDir $acl
    
    Write-Success "Directories created"
}

# Configure Windows Firewall
function Initialize-Firewall {
    Write-Info "Configuring Windows Firewall..."
    
    $ports = @(80, 443, 8080, 9090, 9091)
    
    foreach ($port in $ports) {
        $ruleName = "Allternit Agent - Port $port"
        
        # Remove existing rule if present
        Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
        
        # Create new rule
        New-NetFirewallRule `
            -DisplayName $ruleName `
            -Direction Inbound `
            -LocalPort $port `
            -Protocol TCP `
            -Action Allow `
            -Profile Any `
            -ErrorAction SilentlyContinue | Out-Null
        
        Write-Info "Opened port $port"
    }
    
    Write-Success "Firewall configured"
}

# Create Docker Compose file
function New-DockerComposeFile {
    Write-Info "Creating Docker Compose configuration..."
    
    $composeContent = @"
version: '3.8'

services:
  allternit-agent:
    image: allternit/agent:$script:AllternitVersion
    container_name: allternit-agent
    restart: unless-stopped
    ports:
      - "8080:8080"
      - "9090:9090"
    volumes:
      - "$($script:AllternitConfigDir -replace '\\', '/'):/etc/allternit:ro"
      - "$($script:AllternitDir -replace '\\', '/')/data:/data"
      - "$($script:AllternitLogDir -replace '\\', '/'):/var/log/allternit"
      - type: bind
        source: //./pipe/docker_engine
        target: //./pipe/docker_engine
    environment:
      - Allternit_CONFIG_PATH=/etc/allternit/config.json
      - Allternit_LOG_LEVEL=info
      - Allternit_DATA_DIR=/data
    networks:
      - allternit-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    container_name: allternit-redis
    restart: unless-stopped
    volumes:
      - redis-data:/data
    networks:
      - allternit-network
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

  traefik:
    image: traefik:v3.0
    container_name: allternit-traefik
    restart: unless-stopped
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--ping=true"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - type: bind
        source: //./pipe/docker_engine
        target: //./pipe/docker_engine
    networks:
      - allternit-network

volumes:
  redis-data:

networks:
  allternit-network:
    driver: nat
    ipam:
      config:
        - subnet: 172.20.0.0/16
"@
    
    $composePath = Join-Path $script:AllternitDir "docker-compose.yml"
    $composeContent | Out-File -FilePath $composePath -Encoding UTF8 -Force
    
    Write-Success "Docker Compose file created: $composePath"
}

# Create Windows Service
function New-AllternitService {
    Write-Info "Creating Windows Service..."
    
    # Remove existing service if present
    $existingService = Get-Service -Name $script:ServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Warn "Existing service found. Stopping and removing..."
        Stop-Service -Name $script:ServiceName -Force -ErrorAction SilentlyContinue
        sc.exe delete $script:ServiceName | Out-Null
        Start-Sleep -Seconds 2
    }
    
    # Create service script
    $serviceScript = @"
`$LogFile = "$script:AllternitLogDir\service.log"

function Write-Log {
    param([string]`$Message)
    `$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "`$timestamp - `$Message" | Out-File -Append -FilePath `$LogFile
}

Write-Log "Starting Allternit Agent Service"

try {
    Set-Location "$script:AllternitDir"
    
    # Pull latest images
    Write-Log "Pulling Docker images..."
    docker compose pull 2>&1 | ForEach-Object { Write-Log `$_ }
    
    # Start services
    Write-Log "Starting Docker Compose services..."
    docker compose up -d 2>&1 | ForEach-Object { Write-Log `$_ }
    
    # Monitor services
    while (`$true) {
        Start-Sleep -Seconds 30
        `$status = docker compose ps --format json 2>`$null | ConvertFrom-Json
        if (-not `$status) {
            Write-Log "WARNING: No containers running"
        }
    }
} catch {
    Write-Log "ERROR: `$_"
} finally {
    Write-Log "Stopping Allternit Agent Service"
    docker compose down 2>&1 | ForEach-Object { Write-Log `$_ }
}
"@
    
    $serviceScriptPath = Join-Path $script:AllternitDir "scripts\service.ps1"
    $serviceScript | Out-File -FilePath $serviceScriptPath -Encoding UTF8 -Force
    
    # Create scheduled task as a service alternative (more reliable on Windows)
    $taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$serviceScriptPath`""
    $taskTrigger = New-ScheduledTaskTrigger -AtStartup
    $taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    Register-ScheduledTask `
        -TaskName $script:ServiceName `
        -Action $taskAction `
        -Trigger $taskTrigger `
        -Settings $taskSettings `
        -Principal $taskPrincipal `
        -Force | Out-Null
    
    Write-Success "Windows Service created as Scheduled Task: $script:ServiceName"
}

# Setup log rotation
function Initialize-LogRotation {
    Write-Info "Setting up log rotation..."
    
    $logRotationScript = @"
`$LogDir = "$script:AllternitLogDir"
`$MaxLogSize = 100MB
`$MaxLogFiles = 14

Get-ChildItem -Path `$LogDir -Filter "*.log" | ForEach-Object {
    `$file = `$_
    if (`$file.Length -gt `$MaxLogSize) {
        `$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        `$newName = "`$(`$file.BaseName)_`$timestamp.log"
        Rename-Item -Path `$file.FullName -NewName `$newName
        
        # Compress old log
        Compress-Archive -Path (Join-Path `$LogDir `$newName) -DestinationPath (Join-Path `$LogDir "`$newName.zip") -Force
        Remove-Item -Path (Join-Path `$LogDir `$newName) -Force
    }
}

# Remove old compressed logs
Get-ChildItem -Path `$LogDir -Filter "*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -Skip `$MaxLogFiles | Remove-Item -Force
"@
    
    $rotationScriptPath = Join-Path $script:AllternitDir "scripts\log-rotation.ps1"
    $logRotationScript | Out-File -FilePath $rotationScriptPath -Encoding UTF8 -Force
    
    # Create scheduled task for log rotation
    $taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$rotationScriptPath`""
    $taskTrigger = New-ScheduledTaskTrigger -Daily -At "00:00"
    $taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount
    
    Register-ScheduledTask `
        -TaskName "AllternitLogRotation" `
        -Action $taskAction `
        -Trigger $taskTrigger `
        -Settings $taskSettings `
        -Principal $taskPrincipal `
        -Force | Out-Null
    
    Write-Success "Log rotation configured"
}

# Verify installation
function Test-Installation {
    Write-Info "Verifying installation..."
    
    # Check Docker
    try {
        $dockerVersion = docker version --format '{{.Server.Version}}'
        Write-Info "Docker version: $dockerVersion"
    } catch {
        throw "Docker is not installed or not running"
    }
    
    # Check Docker Compose
    try {
        $composeVersion = docker compose version
        Write-Info "Docker Compose: $composeVersion"
    } catch {
        throw "Docker Compose is not available"
    }
    
    # Check configuration files
    $composePath = Join-Path $script:AllternitDir "docker-compose.yml"
    if (-not (Test-Path $composePath)) {
        throw "Docker Compose file not found"
    }
    
    # Validate docker-compose
    Set-Location $script:AllternitDir
    $validateResult = docker compose config 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose configuration is invalid: $validateResult"
    }
    
    Write-Success "Installation verification passed"
}

# Start the service
function Start-AllternitService {
    Write-Info "Starting Allternit Agent Service..."
    
    Start-ScheduledTask -TaskName $script:ServiceName -ErrorAction SilentlyContinue
    
    Start-Sleep -Seconds 5
    
    # Check if containers are running
    $containers = docker compose ps --format json 2>$null | ConvertFrom-Json
    if ($containers) {
        Write-Success "Allternit Agent containers are starting"
    } else {
        Write-Warn "Containers may still be starting. Check logs for details."
    }
}

# Main installation
function Install-AllternitAgent {
    Write-Info "========================================"
    Write-Info "Allternit Node Agent Installer for Windows"
    Write-Info "Version: $script:AllternitVersion"
    Write-Info "========================================"
    
    try {
        Get-WindowsInfo
        Test-Prerequisites
        Install-Docker
        Initialize-Directories
        Initialize-Firewall
        New-DockerComposeFile
        New-AllternitService
        Initialize-LogRotation
        Test-Installation
        Start-AllternitService
        
        Write-Success "========================================"
        Write-Success "Allternit Agent installation completed!"
        Write-Success "========================================"
        Write-Info ""
        Write-Info "Next steps:"
        Write-Info "  - Check service status: Get-ScheduledTask -TaskName '$script:ServiceName'"
        Write-Info "  - View logs: Get-Content '$script:AllternitLogDir\service.log' -Tail 50"
        Write-Info "  - Docker logs: docker compose -f '$script:AllternitDir\docker-compose.yml' logs -f"
        Write-Info ""
        Write-Info "Configuration directory: $script:AllternitConfigDir"
        Write-Info "Data directory: $script:AllternitDir\data"
        Write-Info "Log directory: $script:AllternitLogDir"
    }
    catch {
        Write-Error "Installation failed: $_"
        exit 1
    }
}

# Uninstall function
function Uninstall-AllternitAgent {
    Write-Info "Uninstalling Allternit Agent..."
    
    # Stop and remove service
    Stop-ScheduledTask -TaskName $script:ServiceName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $script:ServiceName -Confirm:$false -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName "AllternitLogRotation" -Confirm:$false -ErrorAction SilentlyContinue
    
    # Stop and remove containers
    if (Test-Path "$script:AllternitDir\docker-compose.yml") {
        Set-Location $script:AllternitDir
        docker compose down --volumes --remove-orphans 2>$null | Out-Null
    }
    
    # Remove firewall rules
    Remove-NetFirewallRule -DisplayName "Allternit Agent*" -ErrorAction SilentlyContinue
    
    # Remove directories
    Remove-Item -Path $script:AllternitDir -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Success "Allternit Agent uninstalled"
}

# Run installation
Install-AllternitAgent
