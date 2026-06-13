param(
  [string]$EnvPath = ".env.local"
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

$secureKey = Read-Host "Введите demo API key 2GIS" -AsSecureString
$plainKey = Convert-SecureStringToPlainText -SecureValue $secureKey

if ([string]::IsNullOrWhiteSpace($plainKey)) {
  throw "DGIS_API_KEY is empty. Key was not saved."
}

$resolvedPath = Join-Path (Get-Location) $EnvPath
$lines = @()
if (Test-Path -LiteralPath $resolvedPath) {
  $lines = @(Get-Content -LiteralPath $resolvedPath)
}

$nextLines = New-Object System.Collections.Generic.List[string]
$updated = $false
foreach ($line in $lines) {
  if ($line -match "^DGIS_API_KEY=") {
    $nextLines.Add("DGIS_API_KEY=$plainKey")
    $updated = $true
  } else {
    $nextLines.Add($line)
  }
}

if (-not $updated) {
  if ($nextLines.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($nextLines[$nextLines.Count - 1])) {
    $nextLines.Add("")
  }
  $nextLines.Add("DGIS_API_KEY=$plainKey")
}

Set-Content -LiteralPath $resolvedPath -Value $nextLines -Encoding utf8

$plainKey = $null
[GC]::Collect()

Write-Output "DGIS_API_KEY сохранен в $EnvPath. Значение ключа не выводилось."
Write-Output "Теперь выполните: npm run dgis:check"
