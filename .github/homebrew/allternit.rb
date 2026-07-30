# Homebrew formula for Allternit (Allternit Runtime)
# Usage: brew tap allternit/tap && brew install allternit

class Allternit < Formula
  desc "Allternit Agentic OS Platform - Self-contained AI runtime"
  homepage "https://github.com/allternit/allternit"
  version "0.1.0"
  license "MIT"

  # macOS Intel
  if OS.mac? && Hardware::CPU.intel?
    url "https://github.com/allternit/allternit/releases/download/v#{version}/allternit-#{version}-universal-darwin.tar.gz"
    sha256 "PLACEHOLDER_SHA256_INTEL"
  end

  # macOS Apple Silicon
  if OS.mac? && Hardware::CPU.arm?
    url "https://github.com/allternit/allternit/releases/download/v#{version}/allternit-#{version}-universal-darwin.tar.gz"
    sha256 "PLACEHOLDER_SHA256_ARM"
  end

  # Linux x86_64
  if OS.linux? && Hardware::CPU.intel?
    url "https://github.com/allternit/allternit/releases/download/v#{version}/allternit-#{version}-x86_64-linux.tar.gz"
    sha256 "PLACEHOLDER_SHA256_LINUX_X86_64"
  end

  # Linux aarch64
  if OS.linux? && Hardware::CPU.arm?
    url "https://github.com/allternit/allternit/releases/download/v#{version}/allternit-#{version}-aarch64-linux.tar.gz"
    sha256 "PLACEHOLDER_SHA256_LINUX_AARCH64"
  end

  def install
    bin.install "allternit" => "allternit"
    
    # Install shell completions if available
    # bash_completion.install "completions/allternit.bash" => "allternit"
    # zsh_completion.install "completions/_allternit"
    # fish_completion.install "completions/allternit.fish"
  end

  def caveats
    <<~EOS
      Allternit (Allternit Runtime) has been installed!
      
      To get started:
        allternit --help          # Show help
        allternit init            # Initialize Allternit in current directory
        
      Documentation: https://github.com/allternit/allternit#readme
    EOS
  end

  test do
    system "#{bin}/allternit", "--version"
  end
end
