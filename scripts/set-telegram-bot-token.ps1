param(
  [string]$EnvPath = ".env.local",
  [string]$PublicUrl = "https://caloristika-crm-demo.onrender.com",
  [string]$ManagerChatId = "",
  [string]$MiniappShortName = "",
  [switch]$SkipSetup
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

$resolvedPath = Join-Path (Get-Location) $EnvPath
$lines = New-Object System.Collections.Generic.List[string]
if (Test-Path -LiteralPath $resolvedPath) {
  Get-Content -LiteralPath $resolvedPath | ForEach-Object { $lines.Add($_) }
}

$secureToken = Read-Host "Введите TELEGRAM_BOT_TOKEN из BotFather" -AsSecureString
$token = Convert-SecureStringToPlainText -SecureValue $secureToken
if ([string]::IsNullOrWhiteSpace($token)) {
  throw "TELEGRAM_BOT_TOKEN пустой. Настройка остановлена."
}

Set-EnvValue -Lines $lines -Key "TELEGRAM_BOT_TOKEN" -Value $token.Trim()
Set-EnvValue -Lines $lines -Key "PUBLIC_BASE_URL" -Value $PublicUrl.TrimEnd("/")
if (-not [string]::IsNullOrWhiteSpace($ManagerChatId)) {
  Set-EnvValue -Lines $lines -Key "TELEGRAM_MANAGER_CHAT_ID" -Value $ManagerChatId.Trim()
}
if (-not [string]::IsNullOrWhiteSpace($MiniappShortName)) {
  Set-EnvValue -Lines $lines -Key "TELEGRAM_MINIAPP_SHORT_NAME" -Value $MiniappShortName.Trim()
}

Set-Content -LiteralPath $resolvedPath -Value $lines -Encoding utf8
$token = $null
[GC]::Collect()

Write-Output "TELEGRAM_BOT_TOKEN сохранен в $EnvPath. Значение не выводилось."
Write-Output "Обновляю Render env и запускаю deploy..."
npm run render:env:update -- --public-url $PublicUrl --deploy

if (-not $SkipSetup) {
  Write-Output "Настраиваю Telegram webhook, меню и команды через Bot API..."
  npm run telegram:setup
}

Write-Output "Готово. После первого сообщения боту выполните /whoami и при необходимости добавьте TELEGRAM_MANAGER_CHAT_ID."
