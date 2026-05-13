<#
.SYNOPSIS
    Provisions retro-board infra and deploys the app to BW-Sandbox-Dev-001.

.DESCRIPTION
    Two-phase script:
      1. `az deployment group create` against infra/main.bicep
      2. Build + zip the Next.js standalone bundle and deploy to App Service

    Re-runnable. ARM deployments are idempotent. The zip-deploy step always
    pushes a fresh build.

.PARAMETER NameSuffix
    Globally-unique short suffix (3-8 lowercase alphanumeric). Applied to the
    Cosmos account name and the App Service name. Pick once and stick with it.

.PARAMETER SkipBuild
    Skip the Next.js build + zip + deploy phase. Use when iterating on infra
    only.

.PARAMETER SkipInfra
    Skip the Bicep deployment. Use when iterating on app code only.

.PARAMETER WhatIf
    Run `az deployment group what-if` instead of executing the deployment.

.EXAMPLE
    .\deploy.ps1 -NameSuffix jryu01 -WhatIf
    .\deploy.ps1 -NameSuffix jryu01
    .\deploy.ps1 -NameSuffix jryu01 -SkipInfra   # app-only redeploy
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9]{3,8}$')]
    [string] $NameSuffix,

    [switch] $SkipBuild,
    [switch] $SkipInfra,
    [switch] $WhatIf
)

$ErrorActionPreference = 'Stop'

$SubscriptionId   = 'c992dc89-b663-4775-bbc5-d5a6c513793f'  # BW-Sandbox-Dev-001
$ResourceGroup    = 'rg-retro-board'
$Location         = 'uksouth'
$BicepFile        = Join-Path $PSScriptRoot 'main.bicep'
$RepoRoot         = Split-Path $PSScriptRoot -Parent

# -- Prereqs ----------------------------------------------------------------
Write-Host "▸ Checking az CLI..." -ForegroundColor Cyan
$azVersion = az version --output json 2>$null | ConvertFrom-Json
if (-not $azVersion) {
    throw "az CLI not found. Install from https://aka.ms/installazurecliwindows"
}

Write-Host "▸ Verifying signed-in account..." -ForegroundColor Cyan
$account = az account show --output json 2>$null | ConvertFrom-Json
if (-not $account) {
    throw "Not signed in. Run: az login"
}
if ($account.id -ne $SubscriptionId) {
    Write-Host "  Switching subscription → $SubscriptionId" -ForegroundColor Yellow
    az account set --subscription $SubscriptionId | Out-Null
}
Write-Host "  Signed in as $($account.user.name) on $($account.name)" -ForegroundColor Green

Write-Host "▸ Ensuring resource group $ResourceGroup..." -ForegroundColor Cyan
$rg = az group show --name $ResourceGroup --output json 2>$null | ConvertFrom-Json
if (-not $rg) {
    Write-Host "  Creating $ResourceGroup in $Location" -ForegroundColor Yellow
    az group create --name $ResourceGroup --location $Location --output none
    if ($LASTEXITCODE -ne 0) { throw "Failed to create resource group" }
}

# -- Reading secrets --------------------------------------------------------
# These three come from .env.local — same Entra app registration as dev.
$envFile = Join-Path $RepoRoot '.env.local'
if (-not (Test-Path $envFile)) {
    throw "$envFile not found. The script reads Entra app secrets from there."
}
$envLines = Get-Content $envFile | Where-Object { $_ -match '^\s*[A-Z_]+\s*=' }
$envMap = @{}
foreach ($line in $envLines) {
    $parts = $line -split '=', 2
    $envMap[$parts[0].Trim()] = $parts[1].Trim().Trim("'`"")
}
function Get-EnvVar([string] $name) {
    if (-not $envMap.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($envMap[$name])) {
        throw "$name missing from .env.local"
    }
    return $envMap[$name]
}
$entraClientId     = Get-EnvVar 'AUTH_MICROSOFT_ENTRA_ID_ID'
$entraClientSecret = Get-EnvVar 'AUTH_MICROSOFT_ENTRA_ID_SECRET'
$entraIssuer       = Get-EnvVar 'AUTH_MICROSOFT_ENTRA_ID_ISSUER'

# Generate a fresh AUTH_SECRET if .env.local doesn't have one. Re-using a
# secret across dev/prod is fine for a prototype, but prod really should
# have its own. We persist it back so subsequent deploys are stable.
if ($envMap.ContainsKey('AUTH_SECRET_PROD') -and -not [string]::IsNullOrWhiteSpace($envMap['AUTH_SECRET_PROD'])) {
    $authSecret = $envMap['AUTH_SECRET_PROD']
    Write-Host "  Using AUTH_SECRET_PROD from .env.local" -ForegroundColor Green
} else {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 32
    $rng.GetBytes($bytes)
    $authSecret = [Convert]::ToBase64String($bytes)
    Add-Content -Path $envFile -Value "AUTH_SECRET_PROD=$authSecret"
    Write-Host "  Generated AUTH_SECRET_PROD and wrote it to .env.local" -ForegroundColor Yellow
}

# -- Infra phase ------------------------------------------------------------
if (-not $SkipInfra) {
    if ($WhatIf) { $verb = 'what-if' } else { $verb = 'create' }
    Write-Host "▸ Running Bicep deployment ($verb)..." -ForegroundColor Cyan
    $deploymentName = "retro-board-$(Get-Date -Format yyyyMMdd-HHmmss)"

    $params = @(
        "nameSuffix=$NameSuffix"
        "entraAppClientId=$entraClientId"
        "entraAppClientSecret=$entraClientSecret"
        "entraIssuer=$entraIssuer"
        "authSecret=$authSecret"
    )

    az deployment group $verb `
        --name $deploymentName `
        --resource-group $ResourceGroup `
        --template-file $BicepFile `
        --parameters @params

    if ($LASTEXITCODE -ne 0) { throw "Bicep deployment failed (exit $LASTEXITCODE)" }
    if ($WhatIf) {
        Write-Host "▸ what-if complete. Re-run without -WhatIf to apply." -ForegroundColor Yellow
        return
    }

    # Pull outputs for the app-deploy phase.
    $outputs = az deployment group show `
        --name $deploymentName `
        --resource-group $ResourceGroup `
        --query properties.outputs `
        --output json | ConvertFrom-Json

    Write-Host ""
    Write-Host "  App URL:           $($outputs.appUrl.value)" -ForegroundColor Green
    Write-Host "  Cosmos endpoint:   $($outputs.cosmosEndpoint.value)" -ForegroundColor Green
    Write-Host "  Entra redirect:    $($outputs.entraRedirectUri.value)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  ⚠  Add the redirect URI above to your Entra app registration" -ForegroundColor Yellow
    Write-Host "    (Portal → Entra ID → App registrations → your app → Authentication)" -ForegroundColor Yellow
    Write-Host ""

    $script:AppName = $outputs.appName.value
} else {
    $script:AppName = "app-retro-board-$NameSuffix"
}

# -- App-build + zip-deploy phase ------------------------------------------
if ($SkipBuild) {
    Write-Host "▸ Skipping build/deploy phase." -ForegroundColor Yellow
    return
}

Write-Host "▸ Building Next.js standalone bundle..." -ForegroundColor Cyan
Push-Location $RepoRoot
try {
    if (Test-Path .next) { Remove-Item -Recurse -Force .next }
    # PS 5.1 wraps native-command stderr in ErrorRecord; merge to stdout so
    # `$ErrorActionPreference = 'Stop'` doesn't abort on info-level output.
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    bun run build 2>&1 | ForEach-Object { "$_" }
    $buildExit = $LASTEXITCODE
    $ErrorActionPreference = $prevPref
    if ($buildExit -ne 0) { throw "Next.js build failed (exit $buildExit)" }

    # Assemble the deploy bundle. Next.js standalone layout:
    #   .next/standalone/        ← server.js + minimal node_modules
    #   .next/standalone/.next/  ← server output (already nested)
    #   .next/static/            ← must be copied to standalone/.next/static
    #   public/                  ← must be copied to standalone/public (none here yet)
    $stage = Join-Path $RepoRoot '.next\deploy'
    if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
    New-Item -ItemType Directory -Path $stage | Out-Null

    Copy-Item -Recurse -Path '.next\standalone\*' -Destination $stage
    New-Item -ItemType Directory -Force -Path (Join-Path $stage '.next') | Out-Null
    Copy-Item -Recurse -Path '.next\static' -Destination (Join-Path $stage '.next\static')
    if (Test-Path 'public') {
        Copy-Item -Recurse -Path 'public' -Destination (Join-Path $stage 'public')
    }

    $zipPath = Join-Path $RepoRoot '.next\deploy.zip'
    if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
    # Compress-Archive AND ZipFile.CreateFromDirectory on .NET Framework
    # (which PS 5.1 binds to) both write Windows-style backslash separators
    # inside ZIP entries. Linux Kudu's unzip then creates literal-backslash
    # filenames and rsync can't stat them (Invalid argument 22). Build the
    # zip entry-by-entry with forward-slash names.
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $z = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        $stageFull = (Resolve-Path $stage).Path.TrimEnd('\')
        foreach ($file in Get-ChildItem -Path $stage -Recurse -File -Force) {
            $rel = $file.FullName.Substring($stageFull.Length + 1).Replace('\', '/')
            $entry = $z.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
            $es = $entry.Open()
            try {
                $fs = [System.IO.File]::OpenRead($file.FullName)
                try { $fs.CopyTo($es) } finally { $fs.Dispose() }
            } finally { $es.Dispose() }
        }
    } finally {
        $z.Dispose()
    }
    Write-Host "  Bundle: $zipPath ($([math]::Round((Get-Item $zipPath).Length / 1MB, 1)) MB)" -ForegroundColor Green
}
finally {
    Pop-Location
}

Write-Host "▸ Deploying zip to $($script:AppName)..." -ForegroundColor Cyan
$prevPref = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
az webapp deploy `
    --resource-group $ResourceGroup `
    --name $script:AppName `
    --src-path (Join-Path $RepoRoot '.next\deploy.zip') `
    --type zip 2>&1 | ForEach-Object { "$_" }
$deployExit = $LASTEXITCODE
$ErrorActionPreference = $prevPref
if ($deployExit -ne 0) { throw "Zip deploy failed (exit $deployExit)" }

Write-Host ""
Write-Host "▸ Done. Smoke-test at https://$($script:AppName).azurewebsites.net" -ForegroundColor Green
