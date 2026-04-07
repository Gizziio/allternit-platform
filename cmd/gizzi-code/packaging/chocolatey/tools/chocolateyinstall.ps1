$ErrorActionPreference = 'Stop'

$packageName = 'gizzi-code'
$toolsDir = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
$url64 = 'https://github.com/Gizziio/gizzi-code/releases/download/v1.0.0/gizzi-code-1.0.0-windows-x64.exe'
$checksum64 = 'PLACEHOLDER_SHA256'

$packageArgs = @{
  packageName   = $packageName
  unzipLocation = $toolsDir
  fileType      = 'exe'
  url64bit      = $url64
  checksum64    = $checksum64
  checksumType64= 'sha256'
  silentArgs    = '/S'
  validExitCodes= @(0)
}

Install-ChocolateyPackage @packageArgs
