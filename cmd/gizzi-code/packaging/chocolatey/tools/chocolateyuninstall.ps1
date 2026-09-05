$ErrorActionPreference = 'Stop'

$packageName = 'gizzi-code'
$zipFileName = 'gizzi-code-v2.0.2-windows-x64.zip'

Uninstall-ChocolateyZipPackage -PackageName $packageName -ZipFileName $zipFileName
