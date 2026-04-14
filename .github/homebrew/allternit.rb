# Homebrew formula for A2R (A2rchitect Runtime)
# Usage: brew tap a2rchitech/tap && brew install a2r

class A2r < Formula
  desc "A2rchitect Agentic OS Platform - Self-contained AI runtime"
  homepage "https://github.com/a2rchitech/a2rchitech"
  version "0.1.0"
  license "MIT"

  # macOS Intel
  if OS.mac? && Hardware::CPU.intel?
    url "https://github.com/a2rchitech/a2rchitech/releases/download/v#{version}/a2r-#{version}-universal-darwin.tar.gz"
    sha256 "PLACEHOLDER_SHA256_INTEL"
  end

  # macOS Apple Silicon
  if OS.mac? && Hardware::CPU.arm?
    url "https://github.com/a2rchitech/a2rchitech/releases/download/v#{version}/a2r-#{version}-universal-darwin.tar.gz"
    sha256 "PLACEHOLDER_SHA256_ARM"
  end

  # Linux x86_64
  if OS.linux? && Hardware::CPU.intel?
    url "https://github.com/a2rchitech/a2rchitech/releases/download/v#{version}/a2r-#{version}-x86_64-linux.tar.gz"
    sha256 "PLACEHOLDER_SHA256_LINUX_X86_64"
  end

  # Linux aarch64
  if OS.linux? && Hardware::CPU.arm?
    url "https://github.com/a2rchitech/a2rchitech/releases/download/v#{version}/a2r-#{version}-aarch64-linux.tar.gz"
    sha256 "PLACEHOLDER_SHA256_LINUX_AARCH64"
  end

  def install
    bin.install "a2r" => "a2r"
    
    # Install shell completions if available
    # bash_completion.install "completions/a2r.bash" => "a2r"
    # zsh_completion.install "completions/_a2r"
    # fish_completion.install "completions/a2r.fish"
  end

  def caveats
    <<~EOS
      A2R (A2rchitect Runtime) has been installed!
      
      To get started:
        a2r --help          # Show help
        a2r init            # Initialize A2R in current directory
        
      Documentation: https://github.com/a2rchitech/a2rchitech#readme
    EOS
  end

  test do
    system "#{bin}/a2r", "--version"
  end
end
