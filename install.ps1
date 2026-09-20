# Tehran Network Edge Panel - Easy Installer (Windows PowerShell)
# Flow: paste your Cloudflare API token -> the script deploys everything automatically.
# Token is kept only in memory for this session and never saved to disk.
# Requires: Windows PowerShell 5.1+ (run: powershell -ExecutionPolicy Bypass -File install.ps1)
[CmdletBinding()]
param(
  [string]$Token = $env:CF_API_TOKEN,
  [string]$AccountId = $env:TN_ACCOUNT_ID,
  [string]$Name = $env:TN_WORKER_NAME,
  [string]$Password = $env:TN_ADMIN_PASSWORD,
  [string]$Artifact = "",
  [string]$ApiBase = $env:TN_CF_API,
  [string]$PanelBase = $env:TN_PANEL_BASE
)

$ErrorActionPreference = "Stop"
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

if (-not $ApiBase) { $ApiBase = "https://api.cloudflare.com/client/v4" }
$RepoRaw = "https://raw.githubusercontent.com/tehrannetwork021/FreePanel-VPN/main"
$RepoCdn = "https://cdn.jsdelivr.net/gh/tehrannetwork021/FreePanel-VPN@main"

function Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Die($msg) { Write-Host "[X] $msg" -ForegroundColor Red; exit 1 }
function Ok($msg) { Write-Host "OK - $msg" -ForegroundColor Green }

function CfRequest {
  param([string]$Method, [string]$Path, [object]$Body = $null, [string]$ContentType = "application/json", [switch]$Allow404)
  $params = @{
    Method      = $Method
    Uri         = "$ApiBase$Path"
    Headers     = @{ Authorization = "Bearer $Token" }
    ContentType = $ContentType
  }
  if ($null -ne $Body) { $params.Body = $Body }
  try {
    return Invoke-RestMethod @params
  } catch {
    $code = 0
    try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    if ($code -eq 404 -and $Allow404) { return $null }
    if ($code -eq 401) { Die "token-invalid - token wrong or expired. Create a fresh one." }
    if ($code -eq 403) { Die "insufficient-scope - token missing permission. Required: Workers Scripts Edit, Workers KV Storage Edit, Account Settings Read." }
    Die "Cloudflare API call failed ($Method $Path, HTTP $code). $($_.Exception.Message)"
  }
}

Write-Host "==============================================================" -ForegroundColor Magenta
Write-Host "  Tehran Network Edge Panel - Easy Installer (Windows)" -ForegroundColor Magenta
Write-Host "==============================================================" -ForegroundColor Magenta

# ---------- 1) token ----------
if (-not $Token) {
  Write-Host ""
  Write-Host "1) Token creation link (pre-configured scopes) opens below / printed here:"
  Write-Host "https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%5D&accountId=%2A" -ForegroundColor Yellow
  Write-Host "2) Click Create Token, copy it, and paste it here."
  $Token = Read-Host "Cloudflare API Token"
  $Token = ($Token -replace "\s", "")
  if (-not $Token) { Die "token is empty." }
}

Step "1/7 Verifying token"
$verify = CfRequest -Method GET -Path "/user/tokens/verify"
if ($verify.result.status -ne "active") { Die "token not active (status=$($verify.result.status))." }
Ok "token is active"

Step "2/7 Discovering accounts"
$accounts = (CfRequest -Method GET -Path "/accounts?per_page=50").result
if (-not $accounts -or $accounts.Count -eq 0) { Die "no accounts accessible with this token." }
if ($AccountId) {
  $match = $accounts | Where-Object { $_.id -eq $AccountId }
  if (-not $match) { Die "account $AccountId is not accessible with this token." }
} elseif ($accounts.Count -eq 1) {
  $AccountId = $accounts[0].id
} else {
  $i = 1
  foreach ($a in $accounts) { Write-Host ("  {0}) {1}  [{2}]" -f $i, $a.name, $a.id); $i++ }
  $choice = Read-Host "Account number"
  $AccountId = $accounts[[int]$choice - 1].id
}
Ok "account: $AccountId"

Step "3/7 Worker name and admin password"
if (-not $Name) {
  $input_name = Read-Host "Worker name [tehran-network-edge]"
  $Name = if ($input_name) { $input_name } else { "tehran-network-edge" }
}
if ($Name -notmatch "^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$") { Die "invalid worker name (lowercase letters, digits, hyphens only)." }
if (-not $Password) {
  $input_pw = Read-Host "Panel admin password [Enter = generate random]"
  if ($input_pw) { $Password = $input_pw } else {
    $Password = -join (1..32 | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) })
  }
}
Ok "worker: $Name"

Step "4/7 Creating or reusing KV namespace"
$kvTitle = "$Name-config"
$nsList = (CfRequest -Method GET -Path "/accounts/$AccountId/storage/kv/namespaces?per_page=100").result
$kv = $nsList | Where-Object { $_.title -eq $kvTitle } | Select-Object -First 1
if ($kv) { Ok "reusing existing KV namespace" } else {
  $kv = (CfRequest -Method POST -Path "/accounts/$AccountId/storage/kv/namespaces" -Body (@{ title = $kvTitle } | ConvertTo-Json)).result
  Ok "KV namespace created"
}

Step "5/7 Preparing the signed Worker bundle"
$workerPath = $Artifact
if (-not $workerPath) {
  $localBundle = $null
  if ($PSScriptRoot) { $localBundle = Join-Path $PSScriptRoot "dist\edge-worker.js" }
  if ($localBundle -and (Test-Path $localBundle)) { $workerPath = $localBundle } else {
    $workerPath = Join-Path $env:TEMP "tn-edge-worker.js"
    $manifestPath = Join-Path $env:TEMP "tn-edge-worker-manifest.json"
    try { Invoke-WebRequest -UseBasicParsing "$RepoRaw/dist/edge-worker.js" -OutFile $workerPath } catch {
      Invoke-WebRequest -UseBasicParsing "$RepoCdn/dist/edge-worker.js" -OutFile $workerPath }
    try {
      Invoke-WebRequest -UseBasicParsing "$RepoRaw/dist/installer-artifacts/edge-worker-manifest.json" -OutFile $manifestPath
      $expected = ((Get-Content $manifestPath -Raw | ConvertFrom-Json).sha256).ToLower()
      $actual = (Get-FileHash $workerPath -Algorithm SHA256).Hash.ToLower()
      if ($actual -ne $expected) { Die "SHA-256 mismatch ($actual != $expected). Download corrupted." }
      Ok "SHA-256 verified"
    } catch { Write-Host "  (manifest check skipped: $($_.Exception.Message))" -ForegroundColor DarkGray }
  }
}
Ok "bundle ready: $workerPath"

Step "6/7 Uploading Worker (KV + admin secret)"
$metadata = @{
  main_module        = "worker.mjs"
  compatibility_date = "2026-09-19"
  bindings           = @(
    @{ type = "kv_namespace"; name = "C"; namespace_id = $kv.id },
    @{ type = "secret_text"; name = "ADMIN_PASSWORD"; text = $Password }
  )
} | ConvertTo-Json -Compress -Depth 5
$boundary = "----TehranNetwork" + [Guid]::NewGuid().ToString("N")
$crlf = [Text.Encoding]::UTF8.GetBytes("`r`n")
$metaPart = [Text.Encoding]::UTF8.GetBytes("--$boundary`r`nContent-Disposition: form-data; name=`"metadata`"`r`nContent-Type: application/json`r`n`r`n" + $metadata + "`r`n")
$codePart = [Text.Encoding]::UTF8.GetBytes("--$boundary`r`nContent-Disposition: form-data; name=`"worker.mjs`"; filename=`"worker.mjs`"`r`nContent-Type: application/javascript+module`r`n`r`n")
$codeBytes = [IO.File]::ReadAllBytes($workerPath)
$endPart = [Text.Encoding]::UTF8.GetBytes("--$boundary--`r`n")
$ms = New-Object IO.MemoryStream
$ms.Write($metaPart, 0, $metaPart.Length); $ms.Write($codePart, 0, $codePart.Length)
$ms.Write($codeBytes, 0, $codeBytes.Length); $ms.Write($crlf, 0, $crlf.Length)
$ms.Write($endPart, 0, $endPart.Length)
try {
  Invoke-RestMethod -Method Put -Uri "$ApiBase/accounts/$AccountId/workers/scripts/$Name" `
    -Headers @{ Authorization = "Bearer $Token" } `
    -ContentType "multipart/form-data; boundary=$boundary" -Body $ms.ToArray() | Out-Null
} catch {
  $code = 0
  try { $code = [int]$_.Exception.Response.StatusCode } catch {}
  if ($code -eq 401) { Die "token-invalid." }
  if ($code -eq 403) { Die "insufficient-scope - required: Workers Scripts Edit." }
  Die "Worker upload failed (HTTP $code). $($_.Exception.Message)"
}
Ok "Worker uploaded"

Step "7/7 Enabling workers.dev"
$sub = $null
try { $sub = (CfRequest -Method GET -Path "/accounts/$AccountId/workers/subdomain" -Allow404).result.subdomain } catch {}
if (-not $sub) {
  $candidate = "tn-" + $Name.Substring(0, [Math]::Min(20, $Name.Length)) + "-" + (-join (1..6 | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) }))
  $sub = (CfRequest -Method PUT -Path "/accounts/$AccountId/workers/subdomain" -Body (@{ subdomain = $candidate } | ConvertTo-Json)).result.subdomain
  if (-not $sub) { $sub = $candidate }
}
CfRequest -Method POST -Path "/accounts/$AccountId/workers/scripts/$Name/subdomain" -Body (@{ enabled = $true; previews_enabled = $false } | ConvertTo-Json) | Out-Null
Ok "workers.dev enabled"

$panelUrl = if ($PanelBase) { $PanelBase } else { "https://$Name.$sub.workers.dev" }

Step "Health check"
$healthy = $false
foreach ($i in 1..10) {
  try {
    $h = Invoke-RestMethod -Uri "$panelUrl/health" -TimeoutSec 15
    if ($h.ok) { $healthy = $true; break }
  } catch { Start-Sleep -Seconds 3 }
}
if ($healthy) { Ok "panel is responding" } else { Write-Host "! health check failed (workers.dev may be restricted on your network); continuing..." -ForegroundColor Yellow }

Step "Generating configs"
$links = $null
try {
  $links = Invoke-RestMethod -Method Post -Uri "$panelUrl/api/setup" -Headers @{ Authorization = "Bearer $Password" } -ContentType "application/json"
} catch {}

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  Installed successfully - Tehran Network Edge Panel" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  Panel URL:      $panelUrl"
Write-Host "  Admin password: $Password"
Write-Host "  WARNING: save this password now; it is shown only once." -ForegroundColor Yellow
if ($links -and $links.links) {
  Write-Host ""
  Write-Host "  VLESS-WS:     $($links.links.vlessWs)"
  Write-Host "  Trojan-WS:    $($links.links.trojanWs)"
  Write-Host "  XHTTP:        $($links.links.vlessXhttp)"
  Write-Host "  Subscription: $($links.subscriptionUrl)"
  Write-Host ""
  Write-Host "  Paste a link into v2rayNG / Hiddify / Streisand, or add the"
  Write-Host "  subscription URL as a profile."
}
Write-Host ""
Write-Host "  Security: the Cloudflare token stayed in memory only and was never saved."
Write-Host "  Revoke it anytime: https://dash.cloudflare.com/profile/api-tokens"
Write-Host "==============================================================" -ForegroundColor Green
