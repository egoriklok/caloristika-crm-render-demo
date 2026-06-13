param(
  [string]$EnvPath = ".env.local",
  [string]$OwnerId = "",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Convert-SecureStringToPlainText {
  param([securestring]$SecureValue)

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    if ($bstr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }
}

function Read-EnvMap {
  param([string[]]$Lines)

  $map = @{}
  foreach ($line in $Lines) {
    if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$") {
      $map[$Matches[1]] = $Matches[2]
    }
  }
  return $map
}

function Set-EnvValue {
  param(
    [System.Collections.Generic.List[string]]$Lines,
    [string]$Key,
    [string]$Value
  )

  $updated = $false
  for ($index = 0; $index -lt $Lines.Count; $index++) {
    if ($Lines[$index] -match "^$([regex]::Escape($Key))=") {
      $Lines[$index] = "$Key=$Value"
      $updated = $true
      break
    }
  }

  if (-not $updated) {
    if ($Lines.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($Lines[$Lines.Count - 1])) {
      $Lines.Add("")
    }
    $Lines.Add("$Key=$Value")
  }
}

function Read-SecretIfNeeded {
  param(
    [string]$Prompt,
    [string]$ExistingValue,
    [switch]$Required
  )

  if (-not $Force -and -not [string]::IsNullOrWhiteSpace($ExistingValue)) {
    return $ExistingValue
  }

  $secureValue = Read-Host $Prompt -AsSecureString
  $plainValue = Convert-SecureStringToPlainText -SecureValue $secureValue
  if ($Required -and [string]::IsNullOrWhiteSpace($plainValue)) {
    throw "$Prompt is empty. Value was not saved."
  }
  return $plainValue
}

$resolvedPath = Join-Path (Get-Location) $EnvPath
$lines = @()
if (Test-Path -LiteralPath $resolvedPath) {
  $lines = @(Get-Content -LiteralPath $resolvedPath)
}

$envMap = Read-EnvMap -Lines $lines
$nextLines = New-Object System.Collections.Generic.List[string]
foreach ($line in $lines) {
  $nextLines.Add($line)
}

$renderApiKey = Read-SecretIfNeeded `
  -Prompt "Введите Render API key" `
  -ExistingValue $envMap["RENDER_API_KEY"] `
  -Required
$crmAccessKey = Read-SecretIfNeeded `
  -Prompt "Введите CRM_ACCESS_KEY для входа в CRM на Render" `
  -ExistingValue $envMap["CRM_ACCESS_KEY"] `
  -Required

if ([string]::IsNullOrWhiteSpace($OwnerId) -and ($Force -or [string]::IsNullOrWhiteSpace($envMap["RENDER_OWNER_ID"]))) {
  $OwnerId = Read-Host "Введите RENDER_OWNER_ID (можно оставить пустым и найти через npm run render:api -- workspaces)"
}

Set-EnvValue -Lines $nextLines -Key "RENDER_API_KEY" -Value $renderApiKey
Set-EnvValue -Lines $nextLines -Key "CRM_ACCESS_KEY" -Value $crmAccessKey
if (-not [string]::IsNullOrWhiteSpace($OwnerId)) {
  Set-EnvValue -Lines $nextLines -Key "RENDER_OWNER_ID" -Value $OwnerId
}

Set-Content -LiteralPath $resolvedPath -Value $nextLines -Encoding utf8

$renderApiKey = $null
$crmAccessKey = $null
[GC]::Collect()

Write-Output "Render env сохранен в $EnvPath. Значения секретов не выводились."
if ([string]::IsNullOrWhiteSpace($OwnerId)) {
  Write-Output "Теперь выполните: npm run render:api -- workspaces"
  Write-Output "После выбора workspace выполните: npm run render:env -- -OwnerId <tea_...>"
} else {
  Write-Output "Теперь выполните: npm run render:api -- create"
}
