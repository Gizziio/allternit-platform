# Setup script for the Windows desktop guest agent.
# Run this inside a freshly-imaged Windows VM to finish the agent runtime.
# The antifob/incus-windows image already includes the Incus/QEMU guest agent,
# so this script mainly ensures the PowerShell execution policy and optional
# helper programs are present.

$ErrorActionPreference = "Stop"

Write-Host "[allternit-windows-agent] setting execution policy"
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope LocalMachine -Force

Write-Host "[allternit-windows-agent] installing Chocolatey helpers"
# Ensure Chocolatey is available; if not, skip silently (offline images may not have it).
if (Get-Command choco -ErrorAction SilentlyContinue) {
    choco install -y --no-progress googlechrome 2>&1 | Out-Null
    choco install -y --no-progress nssm 2>&1 | Out-Null
}

Write-Host "[allternit-windows-agent] installing Tailscale"
$tailscaleUrl = "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe"
$tailscaleInstaller = "$env:TEMP\tailscale-setup.exe"
try {
    Invoke-WebRequest -Uri $tailscaleUrl -OutFile $tailscaleInstaller -UseBasicParsing
    Start-Process -FilePath $tailscaleInstaller -ArgumentList "/S" -Wait
} catch {
    Write-Warning "Could not install Tailscale: $_"
}

Write-Host "[allternit-windows-agent] verifying Incus agent service"
$agent = Get-Service -Name "Incus" -ErrorAction SilentlyContinue
if (-not $agent) {
    Write-Warning "Incus agent service not found; file/exec operations may not work."
} else {
    Write-Host "Incus agent service status: $($agent.Status)"
}

Write-Host "[allternit-windows-agent] done"
