$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Cloudflared = Join-Path $Root "tools\cloudflared\cloudflared.exe"
$OutLog = Join-Path $Root "logs\cloudflared.out.log"
$ErrLog = Join-Path $Root "logs\cloudflared.err.log"
$PublicUrlFile = Join-Path $Root "logs\cloudflare_tunnel_url.txt"
$PublicCrmUrlFile = Join-Path $Root "logs\public_crm_url.txt"
$PublicAccessKeyFile = Join-Path $Root "logs\public_access_key.txt"
$LocalUrl = "http://localhost:3011"
$AccessKey = $env:CRM_ACCESS_KEY
if (-not $AccessKey -and (Test-Path $PublicAccessKeyFile)) {
  $AccessKey = (Get-Content -Path $PublicAccessKeyFile -Raw).Trim()
}
$LocalCheckUrl = if ($AccessKey) {
  "$LocalUrl/?key=$([uri]::EscapeDataString($AccessKey))"
} else {
  $LocalUrl
}

if (-not (Test-Path $Cloudflared)) {
  throw "cloudflared.exe not found: $Cloudflared"
}

try {
  $localResponse = Invoke-WebRequest -Uri $LocalCheckUrl -UseBasicParsing -TimeoutSec 10
  if ($localResponse.StatusCode -ne 200) {
    throw "CRM returned HTTP $($localResponse.StatusCode)"
  }
} catch {
  throw "CRM is not available at $LocalCheckUrl. Start CRM on port 3011 first."
}

$existing = Get-CimInstance Win32_Process -Filter "name = 'cloudflared.exe'" |
  Where-Object { $_.ExecutablePath -eq $Cloudflared }

foreach ($process in $existing) {
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

Remove-Item -Path $OutLog, $ErrLog, $PublicUrlFile, $PublicCrmUrlFile, $PublicAccessKeyFile -ErrorAction SilentlyContinue

$process = Start-Process `
  -FilePath $Cloudflared `
  -ArgumentList @("tunnel", "--no-autoupdate", "--url", $LocalUrl) `
  -WorkingDirectory $Root `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog `
  -WindowStyle Hidden `
  -PassThru

$publicUrl = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  $logs = @()
  if (Test-Path $OutLog) { $logs += Get-Content -Path $OutLog -ErrorAction SilentlyContinue }
  if (Test-Path $ErrLog) { $logs += Get-Content -Path $ErrLog -ErrorAction SilentlyContinue }

  $publicUrl = ($logs |
    Select-String -Pattern "https://[a-zA-Z0-9.-]+\.trycloudflare\.com" -AllMatches |
    ForEach-Object { $_.Matches.Value } |
    Select-Object -First 1)

  if ($publicUrl) { break }
}

if (-not $publicUrl) {
  throw "Cloudflare Tunnel started as process $($process.Id), but public URL was not found in logs."
}

Set-Content -Path $PublicUrlFile -Value $publicUrl -Encoding UTF8
$publicCrmUrl = if ($AccessKey) {
  "$publicUrl/?key=$([uri]::EscapeDataString($AccessKey))"
} else {
  $publicUrl
}
Set-Content -Path $PublicCrmUrlFile -Value $publicCrmUrl -Encoding UTF8
if ($AccessKey) {
  Set-Content -Path $PublicAccessKeyFile -Value $AccessKey -Encoding UTF8
}

[pscustomobject]@{
  PublicUrl = $publicUrl
  PublicCrmUrl = if ($AccessKey) { "$publicUrl/?key=[hidden]" } else { $publicUrl }
  LocalUrl = $LocalUrl
  AccessKeyEnabled = [bool]$AccessKey
  ProcessId = $process.Id
  UrlFile = $PublicUrlFile
  PublicCrmUrlFile = $PublicCrmUrlFile
}
