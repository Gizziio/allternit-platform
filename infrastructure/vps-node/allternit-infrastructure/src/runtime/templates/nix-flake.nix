{
  description = "A2R Unified Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };

        # Common development tools
        commonTools = with pkgs; [
          # Version control
          git
          git-lfs
          gh
          glab

          # Editors
          vim
          neovim

          # Terminal utilities
          tmux
          htop
          btop
          jq
          yq
          ripgrep
          fd
          fzf
          zoxide
          starship
          direnv

          # Build tools
          gnumake
          cmake
          ninja
          pkg-config
        ];

        # Language-specific tools
        nodeTools = with pkgs; [
          nodejs_20
          pnpm
          bun
          yarn
        ];

        pythonTools = with pkgs; [
          python312
          poetry
          pipx
        ];

        rustTools = with pkgs; [
          rustup
        ];

        goTools = with pkgs; [
          go
          gopls
          gotools
          go-tools
        ];

        infraTools = with pkgs; [
          docker
          docker-compose
          kubectl
          helm
          k9s
          terraform
          terragrunt
          ansible
          pulumi
        ];
      in
      {
        packages = {
          default = pkgs.buildEnv {
            name = "a2r-unified-env";
            paths = commonTools ++ nodeTools ++ pythonTools ++ rustTools ++ goTools ++ infraTools;
          };

          minimal = pkgs.buildEnv {
            name = "a2r-minimal-env";
            paths = commonTools;
          };

          node = pkgs.buildEnv {
            name = "a2r-node-env";
            paths = commonTools ++ nodeTools;
          };

          python = pkgs.buildEnv {
            name = "a2r-python-env";
            paths = commonTools ++ pythonTools;
          };

          rust = pkgs.buildEnv {
            name = "a2r-rust-env";
            paths = commonTools ++ rustTools;
          };

          go = pkgs.buildEnv {
            name = "a2r-go-env";
            paths = commonTools ++ goTools;
          };
        };

        devShells = {
          default = pkgs.mkShell {
            name = "a2r-unified-shell";
            
            buildInputs = commonTools ++ nodeTools ++ pythonTools ++ rustTools ++ goTools ++ infraTools;

            shellHook = ''
              echo "🚀 Welcome to A2R Unified Development Environment!"
              echo ""
              echo "Available tools:"
              echo "  📦 Node.js    : $(node --version 2>/dev/null || echo 'not found')"
              echo "  📦 pnpm       : $(pnpm --version 2>/dev/null || echo 'not found')"
              echo "  🐍 Python     : $(python3 --version 2>/dev/null || echo 'not found')"
              echo "  ⚙️  Rust       : $(rustc --version 2>/dev/null || echo 'run: rustup default stable')"
              echo "  🐹 Go         : $(go version 2>/dev/null || echo 'not found')"
              echo "  🐳 Docker     : $(docker --version 2>/dev/null || echo 'not found')"
              echo "  ☸️  Kubectl    : $(kubectl version --client 2>/dev/null | head -1 || echo 'not found')"
              echo ""
              
              # Initialize starship if available
              if command -v starship &> /dev/null; then
                eval "$(starship init bash 2>/dev/null || starship init zsh 2>/dev/null || true)"
              fi
              
              # Setup direnv
              if command -v direnv &> /dev/null; then
                eval "$(direnv hook bash 2>/dev/null || direnv hook zsh 2>/dev/null || true)"
              fi
              
              # Set helpful environment variables
              export NODE_OPTIONS="--max-old-space-size=4096"
              export PYTHONDONTWRITEBYTECODE=1
              export PYTHONUNBUFFERED=1
              export RUST_BACKTRACE=1
              export CARGO_HOME="$HOME/.cargo"
              export GOPATH="$HOME/go"
              export PATH="$CARGO_HOME/bin:$GOPATH/bin:$PATH"
            '';

            # Environment variables
            NODE_OPTIONS = "--max-old-space-size=4096";
            PYTHONDONTWRITEBYTECODE = "1";
            PYTHONUNBUFFERED = "1";
            RUST_BACKTRACE = "1";
          };

          node = pkgs.mkShell {
            name = "a2r-node-shell";
            buildInputs = commonTools ++ nodeTools;
            shellHook = ''
              echo "🚀 Node.js Development Environment"
              echo "Node: $(node --version)"
              echo "pnpm: $(pnpm --version)"
            '';
          };

          python = pkgs.mkShell {
            name = "a2r-python-shell";
            buildInputs = commonTools ++ pythonTools;
            shellHook = ''
              echo "🐍 Python Development Environment"
              echo "Python: $(python3 --version)"
              echo "Poetry: $(poetry --version)"
            '';
            PYTHONDONTWRITEBYTECODE = "1";
            PYTHONUNBUFFERED = "1";
          };

          rust = pkgs.mkShell {
            name = "a2r-rust-shell";
            buildInputs = commonTools ++ rustTools;
            shellHook = ''
              echo "⚙️  Rust Development Environment"
              rustup default stable 2>/dev/null || true
              echo "Rust: $(rustc --version 2>/dev/null || echo 'Installing...')"
              echo "Cargo: $(cargo --version 2>/dev/null || echo 'Installing...')"
            '';
            RUST_BACKTRACE = "1";
          };

          go = pkgs.mkShell {
            name = "a2r-go-shell";
            buildInputs = commonTools ++ goTools;
            shellHook = ''
              echo "🐹 Go Development Environment"
              echo "Go: $(go version)"
            '';
          };
        };

        # Formatter for the flake itself
        formatter = pkgs.nixpkgs-fmt;
      });
}
