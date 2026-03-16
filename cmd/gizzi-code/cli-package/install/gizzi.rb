# Homebrew formula for Gizzi Code
# Usage: brew tap a2r/gizzi-code && brew install gizzi-code

class GizziCode < Formula
  desc "AI-powered terminal interface and runtime for the A2R ecosystem"
  homepage "https://gizzi.sh"
  url "https://github.com/a2r/gizzi-code/archive/refs/tags/v1.0.0.tar.gz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"
  head "https://github.com/a2r/gizzi-code.git", branch: "main"

  # Bottles for different platforms
  bottle do
    sha256 cellar: :any_skip_relocation, arm64_sonoma: "PLACEHOLDER_ARM64_SONOMA_SHA256"
    sha256 cellar: :any_skip_relocation, arm64_ventura: "PLACEHOLDER_ARM64_VENTURA_SHA256"
    sha256 cellar: :any_skip_relocation, sonoma: "PLACEHOLDER_SONOMA_SHA256"
    sha256 cellar: :any_skip_relocation, ventura: "PLACEHOLDER_VENTURA_SHA256"
    sha256 cellar: :any_skip_relocation, x86_64_linux: "PLACEHOLDER_LINUX_SHA256"
  end

  depends_on "bun" => :build
  depends_on "node" => :optional

  def install
    # Build with Bun
    system "bun", "install"
    system "bun", "run", "build"
    
    # Install binary as 'gizzi' command
    if OS.mac?
      bin.install "dist/gizzi-code-macos" => "gizzi"
    else
      bin.install "dist/gizzi-code-linux" => "gizzi"
    end
    
    # Install shell completions
    generate_completions_from_executable(bin/"gizzi", "completion")
    
    # Install man page
    man1.install "docs/gizzi.1" if File.exist?("docs/gizzi.1")
  end

  def post_install
    (var/"log/gizzi").mkpath
    (var/"run/gizzi").mkpath
  end

  service do
    run [opt_bin/"gizzi", "daemon", "start"]
    keep_alive true
    error_log_path var/"log/gizzi/error.log"
    log_path var/"log/gizzi/output.log"
    working_dir var/"run/gizzi"
  end

  test do
    system "#{bin}/gizzi", "--version"
    system "#{bin}/gizzi", "--help"
  end
end
