# Gizzi Code Installer for Windows
# Usage: irm https://gizzi.sh/install.ps1 | iex

$ErrorActionPreference = "Stop"

# =============================================================================
# BRAND COLORS
# =============================================================================

$Reset = "`e[0m"
$Bold = "`e[1m"
$Dim = "`e[2m"

# Colors
$BrightBlue = "`e[38;5;39m"
$Cyan = "`e[38;5;51m"
$Magenta = "`e[38;5;201m"
$Green = "`e[38;5;82m"
$Yellow = "`e[38;5;220m"
$Red = "`e[38;5;196m"
$Orange = "`e[38;5;208m"

# =============================================================================
# CONFIGURATION
# =============================================================================

$Repo = "Gizziio/gizzi-code"
$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { "$env:LOCALAPPDATA\gizzi" }
$Version = if ($env:VERSION) { $env:VERSION } else { "latest" }
$GithubApi = "https://api.github.com/repos/$Repo"

# =============================================================================
# ASCII ART BANNER
# =============================================================================

function Print-Banner {
    Write-Host ""
    Write-Host "$BrightBlue$Bold    ██████╗ ██╗███████╗███████╗██╗    ██████╗ ██████╗ ██████╗ ███████╗$Reset"
    Write-Host "$BrightBlue$Bold   ██╔════╝ ██║╚══███╔╝╚══███╔╝██║   ██╔════╝██╔═══██╗██╔══██╗██╔════╝$Reset"
    Write-Host "$BrightBlue$Bold   ██║  ███╗██║  ███╔╝   ███╔╝ ██║   ██║     ██║   ██║██║  ██║█████╗  $Reset"
    Write-Host "$BrightBlue$Bold   ██║   ██║██║ ███╔╝   ███╔╝  ██║   ██║     ██║   ██║██║  ██║██╔══╝  $Reset"
    Write-Host "$BrightBlue$Bold   ╚██████╔╝██║███████╗███████╗██║   ╚██████╗╚██████╔╝██████╔╝███████╗$Reset"
    Write-Host "$BrightBlue$Bold    ╚═════╝ ╚═╝╚══════╝╚══════╝╚═╝    ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝$Reset"
    Write-Host ""
    Write-Host "$Dim              AI Terminal Interface for the A2R Ecosystem$Reset"
    Write-Host ""
}

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

function Write-Step($Step, $Message) {
    Write-Host "$BrightBlue●$Reset $Bold$Step$Reset $Message"
}

function Write-Success($Message) {
    Write-Host "$Green✓$Reset $Message"
}

function Write-Error($Message) {
    Write-Host "$Red✗$Reset $Message" -ForegroundColor Red
}

function Write-Warning($Message) {
    Write-Host "$Yellow⚠$Reset $Message"
}

function Write-Info($Message) {
    Write-Host "$Cyanℹ$Reset $Message"
}

function Show-Progress($Current, $Total, $Activity) {
    $percent = [math]::Floor(($Current / $Total) * 100)
    $width = 40
    $filled = [math]::Floor(($Current / $Total) * $width)
    $empty = $width - $filled
    
    $bar = "[" + ("█" * $filled) + ("─" * $empty) + "]"
    Write-Host "`r$Dim$Activity$Reset $BrightBlue$bar$Reset $BrightBlue$percent%$Reset" -NoNewline
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
        return "x64"  # Default to x64
    }
}

# =============================================================================
# VERSION FUNCTIONS
# =============================================================================

function Get-LatestVersion {
    Write-Step "Fetching" "latest version..."
    
    try {
        $response = Invoke-RestMethod -Uri "$GithubApi/releases/latest" -UseBasicParsing
        $version = $response.tag_name
        Write-Success "Latest version: $BrightBlue$version$Reset"
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
    Write-Step "Installing" "via npm..."
    
    if (!(Test-Command "npm")) {
        Write-Error "npm not found. Please install Node.js first:"
        Write-Info "https://nodejs.org/"
        return $false
    }
    
    try {
        npm install -g @gizzi/gizzi-code 2>&1 | Out-Null
        Write-Success "Successfully installed via npm"
        return $true
    } catch {
        Write-Error "npm installation failed"
        return $false
    }
}

function Install-Binary($Platform, $Arch, $Version) {
    Write-Step "Installing" "binary for $Cyan$Platform-$Arch$Reset..."
    
    $BinName = "gizzi-code-$Version-$Platform-$Arch.exe"
    
    $DownloadUrl = if ($Version -eq "latest") {
        "https://github.com/$Repo/releases/latest/download/gizzi-code-win.exe"
    } else {
        "https://github.com/$Repo/releases/download/$Version/$BinName"
    }
    
    Write-Info "Downloading from: $Dim$DownloadUrl$Reset"
    
    # Create install directory
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    
    $TempFile = [System.IO.Path]::GetTempFileName()
    
    try {
        # Download with progress
        $ProgressPreference = 'Continue'
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempFile -UseBasicParsing
        
        # Install as 'gizzi-code.exe'
        $TargetPath = Join-Path $InstallDir "gizzi-code.exe"
        Move-Item -Path $TempFile -Destination $TargetPath -Force
        
        Write-Success "Binary installed to $Cyan$TargetPath$Reset"
        
        # Add to PATH if not already there
        $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($UserPath -notlike "*$InstallDir*") {
            [Environment]::SetEnvironmentVariable(
                "Path",
                "$UserPath;$InstallDir",
                "User"
            )
            Write-Success "Added $Cyan$InstallDir$Reset to PATH"
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
    Write-Step "Verifying" "installation..."
    
    $GizziPath = Join-Path $InstallDir "gizzi-code.exe"
    
    if (Test-Path $GizziPath) {
        Write-Success "gizzi-code is installed!"
        try {
            $version = & $GizziPath --version 2>$null
            Write-Info "Version: $BrightBlue$version$Reset"
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
    Write-Host "$Green$Bold╔══════════════════════════════════════════════════════════════╗$Reset"
    Write-Host "$Green$Bold║                                                              ║$Reset"
    Write-Host "$Green$Bold║$Reset   $BrightBlue$BoldInstallation Complete!$Reset                                    $Green$Bold║$Reset"
    Write-Host "$Green$Bold║                                                              ║$Reset"
    Write-Host "$Green$Bold╚══════════════════════════════════════════════════════════════╝$Reset"
    Write-Host ""
    
    Write-Host "$Bold$Reset$Reset Get started:$Reset"
    Write-Host "  $Cyan$Bold$Reset gizzi-code$Reset              Start the TUI"
    Write-Host "  $Cyan$Bold$Reset gizzi-code --help$Reset       Show all commands"
    Write-Host "  $Cyan$Bold$Reset gizzi-code --version$Reset    Check version"
    Write-Host ""
    
    Write-Host "$Bold$Reset Documentation:$Reset"
    Write-Host "  $BrightBlue$Reset https://docs.gizzi.sh$Reset"
    Write-Host "  $BrightBlue$Reset https://github.com/Gizziio/gizzi-code$Reset"
    Write-Host ""
    
    Write-Host "$Dim$Reset Need help? Run: gizzi-code --help$Reset"
    Write-Host ""
}

# =============================================================================
# MAIN
# =============================================================================

# Clear-Host (optional, for clean install experience)

Print-Banner

$Platform = Get-Platform
$Arch = Get-Architecture

Write-Info "Platform: $Cyan$Platform$Reset"
Write-Info "Architecture: $Cyan$Arch$Reset"
Write-Info "Install directory: $Cyan$InstallDir$Reset"
Write-Host ""

# Get version
$TargetVersion = if ($Version -eq "latest") {
    Get-LatestVersion
} else {
    Write-Info "Installing version: $BrightBlue$Version$Reset"
    $Version
}
Write-Host ""

# Check if already installed
if (Test-Command "gizzi-code") {
    $CurrentVersion = & gizzi-code --version 2>$null | Select-Object -First 1
    Write-Warning "Gizzi Code is already installed: $BrightBlue$CurrentVersion$Reset"
    Write-Info "Location: $(Get-Command gizzi-code | Select-Object -ExpandProperty Source)"
    Write-Host ""
    $Reinstall = Read-Host "Reinstall/Update? [y/N]"
    if ($Reinstall -notmatch "^[Yy]$") {
        Write-Info "Installation cancelled."
        Print-PostInstall
        exit 0
    }
}

# Install
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
