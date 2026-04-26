# Gizzi Code Installer for Windows
# Usage: irm https://install.gizziio.com/install.ps1 | iex

$ErrorActionPreference = "Stop"

# =============================================================================
# GIZZI BRAND COLORS (from mascot)
# =============================================================================

$Reset = "`e[0m"
$Bold = "`e[1m"
$Dim = "`e[2m"

# Primary brand colors (approximate for PowerShell)
$Orange = "`e[38;5;173m"     # #d97757 - Main brand color
$Beige = "`e[38;5;180m"      # #d4b08c - Secondary
$Brown = "`e[38;5;95m"       # #8f6f56 - Tertiary

# Functional colors
$Green = "`e[38;5;114m"      # Success
$Yellow = "`e[38;5;220m"     # Warning
$Red = "`e[38;5;203m"        # Error
$Cyan = "`e[38;5;80m"        # Info/accent

# =============================================================================
# GIZZI MASCOT ASCII ART
# =============================================================================

function Print-Mascot {
    Write-Host ""
    Write-Host "$Orange      ▄▄      $Reset"
    Write-Host "$Beige   ▄▄▄  ▄▄▄   $Reset"
    Write-Host "$Beige ▄██████████▄ $Reset"
    Write-Host "$Beige █  $Dim●    ●$Beige  █ $Reset"
    Write-Host "$Beige █  A : / / █ $Reset"
    Write-Host "$Beige  ▀████████▀  $Reset"
    Write-Host "$Brown   █ █  █ █   $Reset"
    Write-Host "$Brown   ▀ ▀  ▀ ▀   $Reset"
}

# =============================================================================
# CONFIGURATION
# =============================================================================

$Repo = "Gizziio/allternit-platform"
$AssetPrefix = "gizzi-code"
$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { "$env:LOCALAPPDATA\gizzi" }
$Version = if ($env:VERSION) { $env:VERSION } else { "latest" }
$GithubApi = "https://api.github.com/repos/$Repo"

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

function Write-Color($Color, $Message, $NoNewline = $false) {
    if ($NoNewline) {
        Write-Host "$Color$Message$Reset" -NoNewline
    } else {
        Write-Host "$Color$Message$Reset"
    }
}

function Write-Step($Step) {
    Write-Host "$Orange●$Reset $Bold$Step$Reset"
}

function Write-Success($Message) {
    Write-Host "$Green✓$Reset $Message"
}

function Write-Error($Message) {
    Write-Host "$Red✗$Reset $Message"
}

function Write-Warning($Message) {
    Write-Host "$Yellow⚠$Reset $Message"
}

function Write-Info($Message) {
    Write-Host "$Cyanℹ$Reset $Message"
}

function Test-Command($Command) {
    return [bool](Get-Command -Name $Command -ErrorAction SilentlyContinue)
}

# =============================================================================
# PLATFORM DETECTION
# =============================================================================

function Get-Platform {
    return "windows"
}

function Get-Architecture {
    if ($env:PROCESSOR_ARCHITECTURE -eq "AMD64") {
        return "x64"
    } elseif ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
        return "arm64"
    } else {
        return "x64"
    }
}

# =============================================================================
# VERSION FUNCTIONS
# =============================================================================

function Get-LatestVersion {
    Write-Step "Fetching latest version..."
    
    try {
        $response = Invoke-RestMethod -Uri "$GithubApi/releases/latest" -UseBasicParsing
        $version = $response.tag_name
        Write-Success "Latest version: $Orange$version$Reset"
        return $version
    } catch {
        Write-Error "Failed to fetch latest version"
        exit 1
    }
}

# =============================================================================
# INSTALLATION METHODS
# =============================================================================

function Install-Npm {
    Write-Step "Installing via npm..."
    
    if (!(Test-Command "npm")) {
        Write-Error "npm not found. Please install Node.js first:"
        Write-Info "https://nodejs.org/"
        return $false
    }
    
    try {
        npm install -g @allternit/gizzi-code 2>&1 | Out-Null
        Write-Success "Successfully installed via npm"
        return $true
    } catch {
        Write-Error "npm installation failed"
        return $false
    }
}

function Install-Binary($Platform, $Arch, $Version) {
    Write-Step "Installing binary for $Beige$Platform-$Arch$Reset..."
    
    $BinName = "gizzi-code-$Version-$Platform-$Arch.exe"
    
    $DownloadUrl = if ($Version -eq "latest") {
        "https://github.com/$Repo/releases/latest/download/${AssetPrefix}-windows-x64.exe"
    } else {
        "https://github.com/$Repo/releases/download/gizzi-code/$Version/${AssetPrefix}-${Version}-windows-x64.exe"
    }
    
    Write-Info "Downloading from: $Dim$DownloadUrl$Reset"
    
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    
    $TempFile = [System.IO.Path]::GetTempFileName()
    
    try {
        $ProgressPreference = 'Continue'
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempFile -UseBasicParsing
        
        $TargetPath = Join-Path $InstallDir "gizzi-code.exe"
        Move-Item -Path $TempFile -Destination $TargetPath -Force
        
        Write-Success "Binary installed to $Beige$TargetPath$Reset"
        
        $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($UserPath -notlike "*$InstallDir*") {
            [Environment]::SetEnvironmentVariable(
                "Path",
                "$UserPath;$InstallDir",
                "User"
            )
            Write-Success "Added $Beige$InstallDir$Reset to PATH"
            Write-Warning "Please restart your terminal to use 'gizzi-code' command"
        }
        
        return $true
    } catch {
        Write-Error "Failed to download or install binary"
        Write-Host $_
        return $false
    } finally {
        if (Test-Path $TempFile) {
            Remove-Item $TempFile -ErrorAction SilentlyContinue
        }
    }
}

# =============================================================================
# VERIFICATION
# =============================================================================

function Verify-Installation {
    Write-Step "Verifying installation..."
    
    $GizziPath = Join-Path $InstallDir "gizzi-code.exe"
    
    if (Test-Path $GizziPath) {
        Write-Success "gizzi-code is installed!"
        try {
            $version = & $GizziPath --version 2>$null
            Write-Info "Version: $Orange$version$Reset"
        } catch {
            # Ignore version check error
        }
        return $true
    } else {
        Write-Warning "gizzi-code installed but not found"
        Write-Info "Add this to your environment variables:"
        Write-Color $Cyan "  $InstallDir"
        return $false
    }
}

# =============================================================================
# POST-INSTALL
# =============================================================================

function Print-PostInstall {
    Write-Host ""
    Write-Host "$Beige$Bold╔══════════════════════════════════════════════════════════════╗$Reset"
    Write-Host "$Beige$Bold║                                                              ║$Reset"
    Write-Host "$Beige$Bold║$Reset   $Orange$BoldInstallation Complete!$Reset                                    $Beige$Bold║$Reset"
    Write-Host "$Beige$Bold║                                                              ║$Reset"
    Write-Host "$Beige$Bold╚══════════════════════════════════════════════════════════════╝$Reset"
    Write-Host ""
    
    Write-Host "$Bold$Reset Get started:$Reset"
    Write-Host "  $Orange$Reset gizzi-code$Reset              Start the TUI"
    Write-Host "  $Orange$Reset gizzi-code --help$Reset       Show all commands"
    Write-Host "  $Orange$Reset gizzi-code --version$Reset    Check version"
    Write-Host ""
    
    Write-Host "$Bold$Reset Documentation:$Reset"
    Write-Host "  $Cyan$Reset https://docs.allternit.com$Reset"
    Write-Host "  $Cyan$Reset https://github.com/Gizziio/allternit-platform$Reset"
    Write-Host ""
    
    Write-Host "$Dim$Reset Need help? Run: gizzi-code --help$Reset"
    Write-Host ""
}

# =============================================================================
# MAIN
# =============================================================================

Write-Host ""
Print-Mascot
Write-Host ""
Write-Host "$Beige$Bold              GIZZI CODE - AI Terminal Interface$Reset"
Write-Host "$Dim                    for the Allternit Ecosystem$Reset"
Write-Host ""

$Platform = Get-Platform
$Arch = Get-Architecture

Write-Info "Platform: $Beige$Platform$Reset"
Write-Info "Architecture: $Beige$Arch$Reset"
Write-Info "Install directory: $Beige$InstallDir$Reset"
Write-Host ""

$TargetVersion = if ($Version -eq "latest") {
    Get-LatestVersion
} else {
    Write-Info "Installing version: $Orange$Version$Reset"
    $Version
}
Write-Host ""

if (Test-Command "gizzi-code") {
    $CurrentVersion = & gizzi-code --version 2>$null | Select-Object -First 1
    Write-Warning "Gizzi Code is already installed: $Orange$CurrentVersion$Reset"
    Write-Info "Location: $(Get-Command gizzi-code | Select-Object -ExpandProperty Source)"
    Write-Host ""
    $Reinstall = Read-Host "Reinstall/Update? [y/N]"
    if ($Reinstall -notmatch "^[Yy]$") {
        Write-Info "Installation cancelled."
        Print-PostInstall
        exit 0
    }
}

$InstallSuccess = $false

if (Test-Command "npm") {
    Write-Info "Node.js detected. Installing via npm..."
    if (Install-Npm) {
        $InstallSuccess = $true
    }
}

if (-not $InstallSuccess) {
    $InstallSuccess = Install-Binary -Platform $Platform -Arch $Arch -Version $TargetVersion
}

Write-Host ""
Verify-Installation
Write-Host ""

Print-PostInstall
