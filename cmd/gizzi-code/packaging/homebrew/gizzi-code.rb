class GizziCode < Formula
  desc "AI-powered terminal interface for the Allternit ecosystem"
  homepage "https://docs.gizziio.com"
  url "https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v1.0.0/gizzi-code-v1.0.0-darwin-arm64.tar.gz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"
  version "1.0.0"

  # macOS ARM64 (Apple Silicon)
  if OS.mac? && Hardware::CPU.arm?
    url "https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v#{version}/gizzi-code-v#{version}-darwin-arm64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_ARM64"
  end

  # macOS Intel
  if OS.mac? && Hardware::CPU.intel?
    url "https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v#{version}/gizzi-code-v#{version}-darwin-x64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_X64"
  end

  # Linux ARM64
  if OS.linux? && Hardware::CPU.arm?
    url "https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v#{version}/gizzi-code-v#{version}-linux-arm64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_LINUX_ARM64"
  end

  # Linux x64
  if OS.linux? && Hardware::CPU.intel?
    url "https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v#{version}/gizzi-code-v#{version}-linux-x64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_LINUX_X64"
  end

  def install
    bin.install "gizzi-code"
    
    # Install shell completions
    bash_completion.install "completions/gizzi-code.bash" if File.exist?("completions/gizzi-code.bash")
    zsh_completion.install "completions/_gizzi-code" if File.exist?("completions/_gizzi-code")
    fish_completion.install "completions/gizzi-code.fish" if File.exist?("completions/gizzi-code.fish")
  end

  test do
    system "#{bin}/gizzi-code", "--version"
  end
end
