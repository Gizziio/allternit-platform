# validate_pack.ps1 - Summit OIC Tenant Pack Validator (PowerShell)
# Must pass before running demos

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path "$ScriptDir\..\.."
$TenantDir = "$RepoRoot\tenants\summit_oic"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Summit OIC Tenant Pack Validator" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$Errors = 0
$Warnings = 0

function Check-File {
    param($Path)
    if (Test-Path $Path) {
        Write-Host "✓ Found: $Path" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ Missing: $Path" -ForegroundColor Red
        $script:Errors++
        return $false
    }
}

function Check-Dir {
    param($Path)
    if (Test-Path $Path -PathType Container) {
        Write-Host "✓ Found: $Path" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ Missing: $Path" -ForegroundColor Red
        $script:Errors++
        return $false
    }
}

function Check-JsonValid {
    param($Path)
    try {
        Get-Content $Path | ConvertFrom-Json | Out-Null
        Write-Host "✓ Valid JSON: $Path" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "✗ Invalid JSON: $Path" -ForegroundColor Red
        $script:Errors++
        return $false
    }
}

Write-Host "1. Checking required directories..." -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Gray
Check-Dir "$TenantDir"
Check-Dir "$TenantDir\skills"
Check-Dir "$TenantDir\tools"
Check-Dir "$TenantDir\forms"
Check-Dir "$TenantDir\memory"
Check-Dir "$TenantDir\policies"
Check-Dir "$TenantDir\tests"
Write-Host ""

Write-Host "2. Checking skill files..." -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Gray
Check-File "$TenantDir\skills\canvas\module_builder.skill.md"
Check-File "$TenantDir\skills\office\excel_editor.skill.md"
Check-File "$TenantDir\skills\desktop\cowork_portal_runner.skill.md"
Write-Host ""

Write-Host "3. Checking form definitions..." -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Gray
Check-File "$TenantDir\forms\module_builder.form.json"
Check-JsonValid "$TenantDir\forms\module_builder.form.json"
Write-Host ""

Write-Host "4. Checking tenant configuration..." -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Gray
Check-File "$TenantDir\tenant.json"
Check-JsonValid "$TenantDir\tenant.json"
Check-File "$TenantDir\pack.lock.json"
Write-Host ""

Write-Host "5. Checking secrets (should NOT be present in pack)..." -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Gray
if (Test-Path "$TenantDir\secrets\summit_oic.env") {
    Write-Host "! WARNING: summit_oic.env found (should be provisioned on-site)" -ForegroundColor Yellow
    $script:Warnings++
} else {
    Write-Host "✓ No secrets in pack (correct for distribution)" -ForegroundColor Green
}
Write-Host ""

Write-Host "6. Checking demo artifacts..." -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Gray
Check-File "$ScriptDir\summit_oic.sample.env"
Check-File "$ScriptDir\teacher_profile.sample.json"
Check-File "$ScriptDir\run_demo.ps1"
Check-File "$ScriptDir\validate_pack.ps1"
Write-Host ""

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Validation Summary" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Errors:   $Errors" -ForegroundColor $(if ($Errors -gt 0) {"Red"} else {"Green"})
Write-Host "Warnings: $Warnings" -ForegroundColor $(if ($Warnings -gt 0) {"Yellow"} else {"Green"})
Write-Host ""

if ($Errors -gt 0) {
    Write-Host "VALIDATION FAILED" -ForegroundColor Red
    Write-Host "Fix the errors above before running demos."
    exit 1
} else {
    if ($Warnings -gt 0) {
        Write-Host "VALIDATION PASSED WITH WARNINGS" -ForegroundColor Yellow
    } else {
        Write-Host "VALIDATION PASSED" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "Next step: Run '.\demo\summit_oic\run_demo.ps1'"
    exit 0
}
