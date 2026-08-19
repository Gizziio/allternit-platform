{
  lib,
  stdenv,
  rustPlatform,
  pkg-config,
  cargo-tauri,
  bun,
  nodejs,
  cargo,
  rustc,
  jq,
  wrapGAppsHook4,
  makeWrapper,
  dbus,
  glib,
  gtk4,
  libsoup_3,
  librsvg,
  libappindicator,
  glib-networking,
  openssl,
  webkitgtk_4_1,
  gst_all_1,
  gizzi-code,
}:
rustPlatform.buildRustPackage (finalAttrs: {
  pname = "gizzi-desktop";
  inherit (gizzi-code)
    version
    src
    node_modules
    ;

  cargoRoot = "packages/desktop/src-tauri";
  cargoLock.lockFile = ../packages/desktop/src-tauri/Cargo.lock;
  buildAndTestSubdir = finalAttrs.cargoRoot;

  nativeBuildInputs = [
    pkg-config
    cargo-tauri.hook
    bun
    nodejs # for patchShebangs node_modules
    cargo
    rustc
    jq
    makeWrapper
  ] ++ lib.optionals stdenv.hostPlatform.isLinux [ wrapGAppsHook4 ];

  buildInputs = lib.optionals stdenv.isLinux [
    dbus
    glib
    gtk4
    libsoup_3
    librsvg
    libappindicator
    glib-networking
    openssl
    webkitgtk_4_1
    gst_all_1.gstreamer
    gst_all_1.gst-plugins-base
    gst_all_1.gst-plugins-good
    gst_all_1.gst-plugins-bad
  ];

  strictDeps = true;

  preBuild = ''
    cp -a ${finalAttrs.node_modules}/{node_modules,packages} .
    chmod -R u+w node_modules packages
    patchShebangs node_modules
    patchShebangs packages/desktop/node_modules

    mkdir -p packages/desktop/src-tauri/sidecars
    cp ${gizzi-code}/bin/gizzi-code packages/desktop/src-tauri/sidecars/gizzi-code-cli-${stdenv.hostPlatform.rust.rustcTarget}
  '';

  # see publish-tauri job in .github/workflows/publish.yml
  tauriBuildFlags = [
    "--config"
    "tauri.prod.conf.json"
    "--no-sign" # no code signing or auto updates
  ];

  # FIXME: workaround for concerns about case insensitive filesystems
  # should be removed once binary is renamed or decided otherwise
  # darwin output is a .app bundle so no conflict
  postFixup = lib.optionalString stdenv.hostPlatform.isLinux ''
    mv "$out/bin/Gizzi Code" $out/bin/gizzi-desktop
    sed -i 's|^Exec=Gizzi Code$|Exec=gizzi-desktop|' "$out/share/applications/Gizzi Code.desktop"
  '';

  meta = {
    description = "Gizzi Code Desktop App";
    homepage = "https://gizzi.io";
    license = lib.licenses.mit;
    mainProgram = "gizzi-desktop";
    inherit (gizzi-code.meta) platforms;
  };
})
