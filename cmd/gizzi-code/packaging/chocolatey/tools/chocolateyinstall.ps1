$ErrorActionPreference = 'Stop'

$packageName = 'gizzi-code'
$toolsDir = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
# Release assets are version-named zips: gizzi-code-v<version>-windows-x64.zip
$url64 = 'https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v2.0.2/gizzi-code-v2.0.2-windows-x64.zip'
$checksum64 = '3ea78cfe177c6c6cc3ebe5bed82dfc981a1087856d54cb2ba7956d3771e04423'

$packageArgs = @{
  packageName    = $packageName
  unzipLocation  = $toolsDir
  url64bit       = $url64
  checksum64     = $checksum64
  checksumType64 = 'sha256'
}

Install-ChocolateyZipPackage @packageArgs
