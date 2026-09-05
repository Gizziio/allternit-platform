$ErrorActionPreference = 'Stop'

$packageName = 'gizzi-code'
$toolsDir = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
# Release assets are version-named zips: gizzi-code-v<version>-windows-x64.zip
$url64 = 'https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v2.0.1/gizzi-code-v2.0.1-windows-x64.zip'
$checksum64 = 'f4e0184f3a2ac046732b479874f6b35d8a24b368900680c2a781e30f276412be'

$packageArgs = @{
  packageName    = $packageName
  unzipLocation  = $toolsDir
  url64bit       = $url64
  checksum64     = $checksum64
  checksumType64 = 'sha256'
}

Install-ChocolateyZipPackage @packageArgs
