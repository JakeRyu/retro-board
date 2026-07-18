---
name: deploy
description: Deploy retro-board (Next.js + Cosmos DB) to Azure. Use when the user asks to deploy, redeploy, push to prod, ship to Azure, or update the running app. Wraps `infra/deploy.ps1`, which provisions infra via Bicep (idempotent) and ships the Next.js standalone bundle to App Service. Always run `-WhatIf` first for infra changes; the build+deploy phase can run standalone via `-SkipInfra`.
---

# Deploy retro-board to Azure

Target environment: BW-Sandbox-Dev-001 (`c992dc89-b663-4775-bbc5-d5a6c513793f`), resource group `rg-retro-board`, UK South. See [BW Azure memory](../../../memory/project_bw_azure.md) for the policy/network rationale.

## Files

- `infra/main.bicep` — VNet + Cosmos (PE-only) + App Service + MI role assignment
- `infra/deploy.ps1` — PowerShell driver. Three phases: infra deploy → build → zip-deploy
- `.env.local` — read for `AUTH_MICROSOFT_ENTRA_ID_{ID,SECRET,ISSUER}` and `AUTH_SECRET_PROD` (auto-generated on first run, persisted)

## Common invocations

```powershell
# Preview infra changes only
.\infra\deploy.ps1 -NameSuffix jryu -WhatIf -SkipBuild

# App-only redeploy (most common — code change, no infra)
.\infra\deploy.ps1 -NameSuffix jryu -SkipInfra

# Full deploy from a clean slate
.\infra\deploy.ps1 -NameSuffix jryu
```

`-NameSuffix` is the globally-unique suffix on Cosmos + App Service names. For the existing deployment it's `jryu`. Don't change it unless rebuilding from scratch — both Cosmos and the App Service have fixed names tied to it.

## Workflow

1. **Sanity check** — confirm PIM Contributor is active on BW-Sandbox-Dev-001 (`az account list --all` should show it as `Enabled`). If missing, instruct the user to activate via portal → Microsoft Entra Privileged Identity Management.
2. **Stop the local dev server** if running — it holds `.next/` open and the build phase will fail to clean it.
3. **Infra phase** (skip with `-SkipInfra` for code-only deploys):
   - Confirms az login + correct sub
   - Creates `rg-retro-board` if missing
   - Reads Entra app secrets from `.env.local`
   - Generates `AUTH_SECRET_PROD` on first run and persists it
   - Runs `az deployment group create` against `infra/main.bicep`
   - Prints the Entra redirect URI the user needs to add manually
4. **Build phase**:
   - `bun run build` produces `.next/standalone/`
   - Stages `.next/standalone/` + `.next/static/` + `public/` into `.next/deploy/`
   - Zips into `.next/deploy.zip` with **forward-slash paths** (see gotcha below)
5. **Deploy phase**:
   - `az webapp deploy --type zip --track-status true` pushes the zip; waits for "RuntimeSuccessful"
6. **Smoke test**:
   - `curl -s -o NUL -w "%{http_code}" https://app-retro-board-jryu.azurewebsites.net/api/auth/providers` → 200
   - User browser-tests login + board CRUD

## Manual steps the script can't do

- **Entra app redirect URI** — after the first infra deploy, the user must add `https://app-retro-board-jryu.azurewebsites.net/api/auth/callback/microsoft-entra-id` to the Entra app registration (client id from `.env.local`). Portal → Entra ID → App registrations → the app → Authentication. One-time.
- **Cosmos seed** — the cloud Cosmos has `publicNetworkAccess: Disabled`, so localhost can't seed it directly. Either skip (users create their own boards) or temporarily add a firewall IP rule for the user's IP, seed, then remove the rule.

## Environment prerequisites (one-time per workstation)

If `az ...` returns SSL errors against `login.microsoftonline.com` or `aka.ms`, Netskope TLS interception is the cause. Fix:

```powershell
# Build a combined CA bundle including the Netskope + BW root CAs
$outDir = "$env:USERPROFILE\.azure\custom-ca"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$bundle = Join-Path $outDir 'az-cli-bundle.pem'
Copy-Item "C:\Program Files\Microsoft SDKs\Azure\CLI2\Lib\site-packages\certifi\cacert.pem" $bundle -Force
foreach ($cert in Get-ChildItem -Path Cert:\LocalMachine\Root, Cert:\CurrentUser\Root |
        Where-Object { $_.Subject -match 'netSkope|Barnett' }) {
    $b64 = [Convert]::ToBase64String($cert.RawData, 'InsertLineBreaks')
    Add-Content $bundle -Encoding ascii -Value "`n# $($cert.Subject)`n-----BEGIN CERTIFICATE-----`n$b64`n-----END CERTIFICATE-----`n"
}
[Environment]::SetEnvironmentVariable('REQUESTS_CA_BUNDLE', $bundle, 'User')

# Bicep CLI (uses aka.ms which Netskope also breaks)
az config set bicep.check_version=false
az bicep install
```

After this any new PowerShell session has az working.

## Known gotchas (already fixed in deploy.ps1; flag if regressing)

- **Cosmos `EnableServerless` capability rejected** in API version > 2024-05-15-preview. Use `properties.capacityMode: 'Serverless'` instead. Already set in `main.bicep`.
- **PowerShell 5.1 wraps native-command stderr as ErrorRecord**, which trips `$ErrorActionPreference = 'Stop'` even on info-level output (bun, az). The script merges stderr to stdout (`2>&1 | ForEach-Object { "$_" }`) and checks `$LASTEXITCODE` explicitly around `bun run build` and `az webapp deploy`.
- **`Compress-Archive` and `[ZipFile]::CreateFromDirectory()` both write Windows backslash separators** inside ZIP entries on .NET Framework, which Linux Kudu's unzip preserves as literal filename characters; rsync then fails with "Invalid argument (22)". The script builds the zip entry-by-entry with `CreateEntry($rel.Replace('\','/'))`.
- **Next.js `output: 'standalone'`** is required in `next.config.ts` — without it the deploy bundle pulls full `node_modules` (hundreds of MB) and the app won't have a `server.js` entry point.
- **Same-app-instance restart** — `az webapp deploy --restart true` is implicit on `--type zip`. If users report stale content, force restart: `az webapp restart -g rg-retro-board -n app-retro-board-jryu`.

## Cost reference

~£20-30/month at idle. App Service B1 (~£10) + Private Endpoint (~£5) + private DNS zone (~£0.40) + Cosmos serverless (~£0 at idle, pay-per-request).
