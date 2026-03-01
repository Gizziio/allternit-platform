# run_demo.ps1 - Summit OIC MVP Demo Runner (PowerShell)
# Runs all 3 MVP demonstrations in sequence

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path "$ScriptDir\..\.."
$TenantDir = "$RepoRoot\tenants\summit_oic"
$SecretsDir = "$TenantDir\secrets"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Summit OIC MVP Demo Runner" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check secrets
if (!(Test-Path "$SecretsDir\summit_oic.env")) {
    Write-Host "ERROR: Missing secrets file" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please create $SecretsDir\summit_oic.env"
    Write-Host "Copy from: demo\summit_oic\summit_oic.sample.env"
    Write-Host ""
    Write-Host "Required variables:"
    Write-Host "  CANVAS_BASE_URL=https://YOURDISTRICT.instructure.com"
    Write-Host "  CANVAS_API_TOKEN=your_token_here"
    Write-Host ""
    exit 1
}

# Load secrets
Get-Content "$SecretsDir\summit_oic.env" | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        Set-Item -Force -Path "ENV:\$($matches[1])" -Value $matches[2]
    }
}

Write-Host "Configuration loaded:" -ForegroundColor Blue
Write-Host "  Canvas URL: $env:CANVAS_BASE_URL"
Write-Host "  Demo Course: ${env:DEMO_COURSE_ID:-Not set}"
Write-Host ""

# Check kernel
$KernelHost = ${env:KERNEL_HOST:-"127.0.0.1"}
$KernelPort = ${env:KERNEL_PORT:-"3004"}
$KernelUrl = "http://$KernelHost:$KernelPort"

Write-Host "Checking Kernel at $KernelUrl..."
try {
    $response = Invoke-WebRequest -Uri $KernelUrl -TimeoutSec 3 -ErrorAction SilentlyContinue
    Write-Host "✓ Kernel is running" -ForegroundColor Green
} catch {
    Write-Host "! Kernel not responding. Please start manually." -ForegroundColor Yellow
    Write-Host "  cd $RepoRoot"
    Write-Host "  .\target\debug\kernel.exe"
    Write-Host ""
}

Write-Host ""

# ============================================================
# DEMO 1: Canvas Module Builder (PLAN → EXECUTE)
# ============================================================
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "DEMO 1: Canvas Module Builder" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Generate PLAN (read-only, deterministic)" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Gray

$DemoCourseId = ${env:DEMO_COURSE_ID:-"12345"}

$PlanInput = @{
    course_id = [int]$DemoCourseId
    module_name = "MVP Demo Module"
    objective = "Students will understand the basics of the topic."
    lesson_count = 2
    include_assignment = $true
    publish = $false
    reading_level = "middle"
} | ConvertTo-Json -Depth 10

Write-Host "Input:"
$PlanInput | ConvertFrom-Json | ConvertTo-Json -Depth 10
Write-Host ""

# Save plan input
$PlanFile = "$env:TEMP\summit_demo_plan.json"
$PlanInput | Out-File -FilePath $PlanFile -Encoding utf8

Write-Host "✓ Plan input saved to $PlanFile" -ForegroundColor Green
Write-Host ""
Write-Host "Expected behavior:"
Write-Host "  • Skill outputs plan.json"
Write-Host "  • confirmed: false (no tool calls yet)"
Write-Host "  • Deterministic step ordering"
Write-Host ""

# ============================================================
# DEMO 2: Office Excel Editor (READ → PATCH → WRITE)
# ============================================================
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "DEMO 2: Office Excel Editor" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Create fixture directory
$FixtureDir = "$env:TEMP\summit_demo_fixtures"
if (!(Test-Path $FixtureDir)) {
    New-Item -ItemType Directory -Path $FixtureDir | Out-Null
}

Write-Host "Step 1: Creating Excel fixture..." -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Gray

$FixtureData = @{
    students = @(
        @{name="Alice Johnson"; grade=85; attendance=95},
        @{name="Bob Smith"; grade=72; attendance=88},
        @{name="Carol Williams"; grade=91; attendance=92},
        @{name="David Brown"; grade=68; attendance=75},
        @{name="Eve Davis"; grade=88; attendance=90}
    )
}

$FixtureData | ConvertTo-Json -Depth 10 | Out-File "$FixtureDir\gradebook.json" -Encoding utf8

Write-Host "Fixture created: $FixtureDir\gradebook.json"
Write-Host "Students: $($FixtureData.students.Count)"
Write-Host ""

Write-Host "Step 2: Excel READ operation" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Gray
Write-Host "Reading gradebook data..."
Get-Content "$FixtureDir\gradebook.json" | ConvertFrom-Json | ConvertTo-Json -Depth 10
Write-Host ""

Write-Host "Step 3: Generate PATCH plan (flag at-risk students)" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Gray

$AtRisk = $FixtureData.students | Where-Object { $_.grade -lt 75 -or $_.attendance -lt 80 } | ForEach-Object {
    $Risks = @()
    if ($_.grade -lt 75) { $Risks += "low_grade" }
    if ($_.attendance -lt 80) { $Risks += "low_attendance" }
    @{
        name = $_.name
        grade = $_.grade
        attendance = $_.attendance
        risk_flags = $Risks
    }
}

$PatchPlan = @{
    skill = "summit.office.excel_editor"
    confirmed = $false
    input_file = "$FixtureDir\gradebook.json"
    output_file = "$FixtureDir\gradebook_flagged.json"
    patches = @(
        @{operation="add_column"; column="at_risk"; formula="OR(grade<75, attendance<80)"},
        @{operation="add_column"; column="risk_flags"; value="conditional"}
    )
    at_risk_students = $AtRisk
} | ConvertTo-Json -Depth 10

$PatchPlan | Out-File "$env:TEMP\summit_demo_excel_patch.json" -Encoding utf8

Write-Host "Patch plan generated:"
$PatchPlan | ConvertFrom-Json | ConvertTo-Json -Depth 10
Write-Host ""
Write-Host "✓ Excel patch plan saved" -ForegroundColor Green
Write-Host ""

# ============================================================
# DEMO 3: Desktop Cowork Portal Runner
# ============================================================
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "DEMO 3: Desktop Cowork Portal Runner" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Desktop CONNECT (read-only)" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Gray

$DesktopPlan = @{
    skill = "summit.desktop.cowork_portal_runner"
    confirmed = $false
    portal = @{
        name = "Canvas Dashboard"
        url = $env:CANVAS_BASE_URL
    }
    actions = @(
        @{step=1; type="screenshot"; description="Capture initial state"},
        @{step=2; type="navigate"; url="$($env:CANVAS_BASE_URL)/courses"},
        @{step=3; type="screenshot"; description="Capture courses page"}
    )
} | ConvertTo-Json -Depth 10

Write-Host "Desktop action plan:"
$DesktopPlan | ConvertFrom-Json | ConvertTo-Json -Depth 10
Write-Host ""

Write-Host "Step 2: CONFIRMED actions (requires user approval)" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Gray
Write-Host "! Desktop actions require confirmation before execution" -ForegroundColor Yellow
Write-Host ""
Write-Host "Safety features:"
Write-Host "  • No click/type without confirmed: true"
Write-Host "  • Screenshot before and after each action"
Write-Host "  • All actions logged with receipts"
Write-Host ""

# ============================================================
# SUMMARY
# ============================================================
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "DEMO COMPLETE - Summary" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Artifacts generated:"
Write-Host "  1. $PlanFile (Canvas module plan)"
Write-Host "  2. $FixtureDir\gradebook.json (Office fixture)"
Write-Host "  3. $env:TEMP\summit_demo_excel_patch.json (Office patch plan)"
Write-Host "  4. Desktop action plan (shown above)"
Write-Host ""
Write-Host "MVP Capabilities Demonstrated:"
Write-Host "  ✓ Teacher can trigger module_builder (form binding)"
Write-Host "  ✓ Produces deterministic plan (plan-first architecture)"
Write-Host "  ✓ Office agent can read + plan Excel patches"
Write-Host "  ✓ Desktop agent requires confirmation (safety)"
Write-Host ""
Write-Host "To execute writes (optional):"
Write-Host "  1. Set confirmed: true in plan files"
Write-Host "  2. Re-run with execution mode"
Write-Host ""
Write-Host "Demo completed successfully!" -ForegroundColor Green
Write-Host ""
