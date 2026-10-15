param(
    [Parameter(Mandatory = $true)] [string]$SupabaseProjectRef,
    [Parameter(Mandatory = $true)] [string]$VercelProjectId,
    [Parameter(Mandatory = $true)] [string]$VercelTeam
)

$ErrorActionPreference = 'Stop'
$expectedSupabaseRef = 'qyzwruvggwxbmqrurmxh'
$expectedSupabaseName = 'bulldogs-xchange-demo'
$protectedSupabaseRef = 'miwodndxgrdyanrloxig'
$expectedVercelId = 'prj_pv3TMS6MXH4G58DVvQ8eFpgKuyMf'
$expectedVercelName = 'bulldogs-xchange-live-demo'
$expectedVercelTeam = 'johnraycacananta-4646s-projects'
$expectedVercelOwnerDisplay = "johnraycacananta-4646's projects"

function Invoke-NpxReadOnly {
    param([Parameter(Mandatory = $true)] [string[]]$Arguments)
    $npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
    if (-not $npx) { throw 'BLOCKED: npx.cmd is not installed or unavailable.' }
    $stdoutPath = [IO.Path]::GetTempFileName()
    $stderrPath = [IO.Path]::GetTempFileName()
    try {
        $command = '""{0}" {1}"' -f $npx.Source, ($Arguments -join ' ')
        $process = Start-Process -FilePath $env:ComSpec -ArgumentList @('/d', '/s', '/c', $command) `
            -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
        [pscustomobject]@{
            ExitCode = $process.ExitCode
            Stdout = [IO.File]::ReadAllText($stdoutPath)
            Stderr = [IO.File]::ReadAllText($stderrPath)
        }
    }
    finally { Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue }
}

function Assert-CommandSucceeded {
    param([int]$ExitCode, [string]$Operation, [string]$Stderr)
    if ($ExitCode -ne 0) { throw "BLOCKED: $Operation failed.`n$Stderr" }
}

function ConvertFrom-ProviderJson {
    param([string]$Json, [string]$Provider)
    if ([string]::IsNullOrWhiteSpace($Json)) { throw "BLOCKED: $Provider returned no JSON data." }
    try { return @(ConvertFrom-Json -InputObject $Json) }
    catch { throw "BLOCKED: Could not parse $Provider JSON. $($_.Exception.Message)" }
}

function Get-VercelInspectField {
    param([string]$Text, [string]$Field)
    $values = @($Text -split "`r?`n" | ForEach-Object {
        $parts = $_.Trim() -split '\s+', 2
        if ($parts.Count -eq 2 -and $parts[0] -eq $Field) { $parts[1].Trim() }
    })
    if ($values.Count -ne 1 -or [string]::IsNullOrWhiteSpace($values[0])) {
        throw "BLOCKED: Could not extract an unambiguous Vercel $Field value."
    }
    return $values[0]
}

Write-Host ''
Write-Host 'Checking approved deployment targets...' -ForegroundColor Cyan
if ($SupabaseProjectRef -eq $protectedSupabaseRef -or $SupabaseProjectRef -ne $expectedSupabaseRef) { throw 'BLOCKED: Unapproved Supabase project.' }
if ($VercelProjectId -ne $expectedVercelId) { throw 'BLOCKED: Unapproved Vercel project ID.' }
if ($VercelTeam -ne $expectedVercelTeam) { throw 'BLOCKED: Unapproved Vercel team slug.' }
$repositoryRoot = Split-Path $PSScriptRoot -Parent
$supabaseLink = Join-Path $repositoryRoot 'supabase\.temp\project-ref'
if (Test-Path -LiteralPath $supabaseLink) { throw 'BLOCKED: Repository must remain unlinked from Supabase; use an explicit approved --project-ref.' }
$vercelLink = Join-Path $repositoryRoot '.vercel\project.json'
if (-not (Test-Path -LiteralPath $vercelLink)) { throw 'BLOCKED: Local Vercel project link is missing.' }
try { $localVercelProject = Get-Content -LiteralPath $vercelLink -Raw | ConvertFrom-Json }
catch { throw 'BLOCKED: Local Vercel project link is malformed.' }
if ($localVercelProject.projectId -cne $expectedVercelId -or $localVercelProject.projectName -cne $expectedVercelName) {
    throw 'BLOCKED: Local Vercel project link does not match the approved demo project.'
}

$supabaseResult = Invoke-NpxReadOnly @('--yes', 'supabase@latest', 'projects', 'list', '--output', 'json')
Assert-CommandSucceeded $supabaseResult.ExitCode 'Supabase project inventory' $supabaseResult.Stderr
$supabaseProjects = @(ConvertFrom-ProviderJson $supabaseResult.Stdout 'Supabase inventory')
$matchingSupabaseProjects = @($supabaseProjects | Where-Object { $_.id -eq $expectedSupabaseRef -and $_.name -eq $expectedSupabaseName })
if ($matchingSupabaseProjects.Count -ne 1) { throw 'BLOCKED: Supabase target identity verification failed.' }
if (@($supabaseProjects | Where-Object { $_.id -eq $protectedSupabaseRef }).Count -gt 0) {
    Write-Host 'Protected operational Supabase project is visible but was not selected.' -ForegroundColor Yellow
}
Write-Host "PASS: Supabase $expectedSupabaseName" -ForegroundColor Green

$vercelListResult = Invoke-NpxReadOnly @('--yes', 'vercel@64.0.2', 'project', 'ls', '--scope', $expectedVercelTeam, '--json', '--no-color')
Assert-CommandSucceeded $vercelListResult.ExitCode 'Vercel project inventory' $vercelListResult.Stderr
$vercelInventory = @(ConvertFrom-ProviderJson $vercelListResult.Stdout 'Vercel project inventory')
if ($vercelInventory.Count -ne 1 -or $vercelInventory[0].contextName -cne $expectedVercelTeam -or $null -eq $vercelInventory[0].projects) {
    throw 'BLOCKED: Vercel team identity verification failed.'
}
$vercelProjects = @($vercelInventory[0].projects)
$matchingVercelProjects = @($vercelProjects | Where-Object { $_.id -eq $expectedVercelId -and $_.name -eq $expectedVercelName })
if ($matchingVercelProjects.Count -ne 1) { throw 'BLOCKED: Vercel project ID/name verification failed.' }

$vercelInspectResult = Invoke-NpxReadOnly @('--yes', 'vercel@64.0.2', 'project', 'inspect', $expectedVercelName, '--scope', $expectedVercelTeam, '--no-color')
Assert-CommandSucceeded $vercelInspectResult.ExitCode 'Vercel project inspection' $vercelInspectResult.Stderr
$vercelInspectText = $vercelInspectResult.Stdout + [Environment]::NewLine + $vercelInspectResult.Stderr
$actualVercelOwner = Get-VercelInspectField $vercelInspectText 'Owner'
if ($actualVercelOwner -cne $expectedVercelOwnerDisplay) {
    throw "BLOCKED: Vercel owner display verification failed. Expected '$expectedVercelOwnerDisplay'; received '$actualVercelOwner'."
}

Write-Host "PASS: Vercel $expectedVercelName" -ForegroundColor Green
Write-Host "PASS: Vercel team slug $expectedVercelTeam (owner display: $actualVercelOwner)" -ForegroundColor Green
Write-Host ''
Write-Host 'TARGET VERIFICATION PASSED' -ForegroundColor Green
Write-Host "Supabase: $expectedSupabaseName ($expectedSupabaseRef)"
Write-Host "Vercel:   $expectedVercelName ($expectedVercelId)"
Write-Host "Team:     $expectedVercelTeam"
Write-Host ''
Write-Host 'No migrations, seeds, deployments, or cloud mutations executed.' -ForegroundColor Yellow
