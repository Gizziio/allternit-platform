#!/usr/bin/env bash
# Pack gizzi-code.nuspec + tools/ into a community-feed nupkg.
# Push (Windows or nuget): 
#   choco push gizzi-code.<ver>.nupkg --source https://push.chocolatey.org/ --api-key "$CHOCOLATEY_API_KEY"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
python3 - "$ROOT" <<'PY'
import datetime, hashlib, zipfile, sys
from pathlib import Path
from xml.etree import ElementTree as ET

root = Path(sys.argv[1])
nuspec = (root / "gizzi-code.nuspec").read_text()
ns = {"n": "http://schemas.microsoft.com/packaging/2015/06/nuspec.xsd"}
tree = ET.fromstring(nuspec)
version = tree.find("n:metadata/n:version", ns).text
pkg_id = tree.find("n:metadata/n:id", ns).text
out = root / f"{pkg_id}.{version}.nupkg"
content_types = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="psmdcp" ContentType="application/vnd.openxmlformats-package.core-properties+xml" />
  <Default Extension="ps1" ContentType="application/octet-stream" />
  <Default Extension="txt" ContentType="application/octet-stream" />
  <Default Extension="nuspec" ContentType="application/octet" />
</Types>
"""
rels = """<?xml version="1.0" encoding="utf-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://schemas.microsoft.com/packaging/2010/07/manifest" Target="/gizzi-code.nuspec" Id="R1" />
  <Relationship Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="/package/services/metadata/core-properties/core.psmdcp" Id="R2" />
</Relationships>
"""
psmdcp = f"""<?xml version="1.0" encoding="utf-8"?>
<coreProperties xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://schemas.openxmlformats.org/package/2006/metadata/core-properties">
  <dc:creator>Allternit Technologies</dc:creator>
  <dc:description>Gizzi Code Windows package</dc:description>
  <dc:identifier>{pkg_id}</dc:identifier>
  <version>{version}</version>
  <keywords>ai terminal cli tui gizzi allternit</keywords>
  <lastModifiedBy>Allternit</lastModifiedBy>
</coreProperties>
"""
if out.exists():
    out.unlink()
with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", rels)
    z.writestr("package/services/metadata/core-properties/core.psmdcp", psmdcp)
    z.writestr("gizzi-code.nuspec", nuspec)
    for p in sorted((root / "tools").rglob("*")):
        if p.is_file():
            z.write(p, f"tools/{p.relative_to(root / 'tools').as_posix()}")
print(out)
print("sha256", hashlib.sha256(out.read_bytes()).hexdigest())
PY
