{
  lib,
  stdenvNoCC,
  callPackage,
  bun,
  sysctl,
  makeBinaryWrapper,
  ripgrep,
  installShellFiles,
  versionCheckHook,
  writableTmpDirAsHomeHook,
  node_modules ? callPackage ./node_modules.nix { },
}:
let
  platform = stdenvNoCC.hostPlatform;
  bunOs = if platform.isLinux then "linux" else if platform.isDarwin then "darwin" else platform.parsed.kernel.name;
  bunCpu = if platform.isAarch64 then "arm64" else if platform.isx86_64 then "x64" else platform.parsed.cpu.name;
  bunTarget = "${bunOs}-${bunCpu}";
in
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "gizzi-code";
  inherit (node_modules) version src;
  inherit node_modules;

  nativeBuildInputs = [
    bun
    installShellFiles
    makeBinaryWrapper
    writableTmpDirAsHomeHook
  ];

  configurePhase = ''
    runHook preConfigure

    cp -R ${finalAttrs.node_modules}/. .

    runHook postConfigure
  '';

  env.GIZZI_DISABLE_MODELS_FETCH = true;
  env.GIZZI_VERSION = finalAttrs.version;
  env.GIZZI_CHANNEL = "local";

  buildPhase = ''
    runHook preBuild

    bun --bun ./script/build.ts --target=${bunTarget}

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    install -Dm755 dist/gizzi-code-${bunTarget} $out/bin/gizzi-code
    ln -s $out/bin/gizzi-code $out/bin/gizzi

    wrapProgram $out/bin/gizzi-code \
      --prefix PATH : ${
        lib.makeBinPath (
          [
            ripgrep
          ]
          # bun runs sysctl to detect if running on rosetta2
          ++ lib.optional stdenvNoCC.hostPlatform.isDarwin sysctl
        )
      }

    runHook postInstall
  '';

  postInstall = lib.optionalString (stdenvNoCC.buildPlatform.canExecute stdenvNoCC.hostPlatform) ''
    # trick yargs into also generating zsh completions
    installShellCompletion --cmd gizzi-code \
      --bash <($out/bin/gizzi-code completion) \
      --zsh <(SHELL=/bin/zsh $out/bin/gizzi-code completion)
  '';

  nativeInstallCheckInputs = [
    versionCheckHook
    writableTmpDirAsHomeHook
  ];
  doInstallCheck = true;
  versionCheckKeepEnvironment = [ "HOME" "GIZZI_DISABLE_MODELS_FETCH" ];
  versionCheckProgramArg = "--version";

  passthru = {
    jsonschema = "";
  };

  meta = {
    description = "AI-powered terminal interface for the Allternit ecosystem";
    homepage = "https://docs.gizziio.com/";
    license = lib.licenses.mit;
    mainProgram = "gizzi-code";
    inherit (node_modules.meta) platforms;
  };
})
