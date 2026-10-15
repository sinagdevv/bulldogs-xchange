$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'hosted-demo-deploy.ps1'
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('hosted-demo-test-' + [guid]::NewGuid())
$fakeBin = Join-Path $tempRoot 'bin'
New-Item -ItemType Directory -Path $fakeBin | Out-Null

$fakeNpx = @'
@echo off
echo %* | findstr /c:"supabase@latest projects list" >nul
if not errorlevel 1 (
  if not "%FAKE_SUPABASE_ERROR%"=="" echo %FAKE_SUPABASE_ERROR% 1>&2& exit /b 7
  echo %FAKE_SUPABASE_JSON%
  exit /b 0
)
echo %* | findstr /c:"vercel@64.0.2 project ls" >nul
if not errorlevel 1 (
  if not "%FAKE_VERCEL_LIST_ERROR%"=="" echo %FAKE_VERCEL_LIST_ERROR% 1>&2& exit /b 8
  echo %FAKE_VERCEL_JSON%
  exit /b 0
)
echo %* | findstr /c:"vercel@64.0.2 project inspect" >nul
if not errorlevel 1 (
  if not "%FAKE_VERCEL_INSPECT_ERROR%"=="" echo %FAKE_VERCEL_INSPECT_ERROR% 1>&2& exit /b 9
  echo Vercel CLI 64.0.2 1>&2
  echo ID  prj_pv3TMS6MXH4G58DVvQ8eFpgKuyMf 1>&2
  echo Name  bulldogs-xchange-live-demo 1>&2
  echo Owner  %FAKE_VERCEL_OWNER% 1>&2
  exit /b 0
)
exit /b 10
'@
Set-Content -LiteralPath (Join-Path $fakeBin 'npx.cmd') -Value $fakeNpx -Encoding Ascii
$originalPath = $env:PATH
$env:PATH = "$fakeBin;$originalPath"
$approvedArgs = @('-SupabaseProjectRef','qyzwruvggwxbmqrurmxh','-VercelProjectId','prj_pv3TMS6MXH4G58DVvQ8eFpgKuyMf','-VercelTeam','johnraycacananta-4646s-projects')

function Set-GoodFixtures {
    $env:FAKE_SUPABASE_JSON = '[{"id":"qyzwruvggwxbmqrurmxh","name":"bulldogs-xchange-demo"}]'
    $env:FAKE_VERCEL_JSON = '{"contextName":"johnraycacananta-4646s-projects","projects":[{"id":"prj_pv3TMS6MXH4G58DVvQ8eFpgKuyMf","name":"bulldogs-xchange-live-demo"}]}'
    $env:FAKE_VERCEL_OWNER = "johnraycacananta-4646's projects"
    $env:FAKE_SUPABASE_ERROR = $null; $env:FAKE_VERCEL_LIST_ERROR = $null; $env:FAKE_VERCEL_INSPECT_ERROR = $null
}
function Invoke-Case {
    param([string]$Name, [bool]$ShouldPass, [string[]]$Arguments = $approvedArgs)
    $passed = $true
    try {
        $output = & $scriptPath -SupabaseProjectRef $Arguments[1] -VercelProjectId $Arguments[3] -VercelTeam $Arguments[5] *>&1 | Out-String
    }
    catch { $passed = $false; $output = $_ | Out-String }
    if ($passed -ne $ShouldPass) { throw "FAILED: $Name`n$output" }
    if ($ShouldPass -and ($output -notmatch 'PASS: Vercel bulldogs-xchange-live-demo' -or $output -notmatch 'TARGET VERIFICATION PASSED')) {
        throw "FAILED: $Name terminated before complete target verification.`n$output"
    }
    Write-Host "PASS: $Name"
}

try {
    Set-GoodFixtures; Invoke-Case 'successful verification reaches final marker' $true
    Set-GoodFixtures; Invoke-Case 'incorrect Supabase project ID' $false @('-SupabaseProjectRef','wrong','-VercelProjectId',$approvedArgs[3],'-VercelTeam',$approvedArgs[5])
    Set-GoodFixtures; $env:FAKE_SUPABASE_JSON = '[{"id":"qyzwruvggwxbmqrurmxh","name":"wrong"}]'; Invoke-Case 'incorrect Supabase project name' $false
    Set-GoodFixtures; Invoke-Case 'incorrect Vercel project ID' $false @('-SupabaseProjectRef',$approvedArgs[1],'-VercelProjectId','wrong','-VercelTeam',$approvedArgs[5])
    Set-GoodFixtures; $env:FAKE_VERCEL_JSON = '{"contextName":"johnraycacananta-4646s-projects","projects":[{"id":"prj_pv3TMS6MXH4G58DVvQ8eFpgKuyMf","name":"wrong"}]}'; Invoke-Case 'incorrect Vercel project name' $false
    Set-GoodFixtures; Invoke-Case 'incorrect Vercel team slug' $false @('-SupabaseProjectRef',$approvedArgs[1],'-VercelProjectId',$approvedArgs[3],'-VercelTeam','wrong')
    Set-GoodFixtures; $env:FAKE_VERCEL_JSON = '{"contextName":"wrong-team","projects":[]}'; Invoke-Case 'provider returns wrong Vercel team' $false
    Set-GoodFixtures; $env:FAKE_VERCEL_OWNER = 'wrong owner'; Invoke-Case 'incorrect Vercel owner display' $false
    Set-GoodFixtures; $env:FAKE_SUPABASE_JSON = '[]'; Invoke-Case 'missing provider data' $false
    Set-GoodFixtures; $env:FAKE_SUPABASE_JSON = '{bad json'; Invoke-Case 'malformed JSON' $false
    Set-GoodFixtures; $env:FAKE_VERCEL_LIST_ERROR = 'authentication failed'; Invoke-Case 'CLI error' $false
}
finally {
    $env:PATH = $originalPath
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
}
