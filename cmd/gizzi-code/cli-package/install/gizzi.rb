# Homebrew formula for Gizzi Code (binary distribution)
# Usage: brew tap <you>/gizzi && brew install gizzi
#
# NOTE: canonical formula lives in packaging/homebrew/gizzi-code.rb in the
# Gizziio/allternit-platform repo; this copy is for tap distribution.

class GizziCode < Formula
  desc "AI-powered terminal interface and runtime for the Allternit ecosystem"
  homepage "https://docs.gizziio.com"
  version "2.0.4"
  license "MIT"

  # Release tags look like "gizzi-code/v1.0.2"; assets are version-named:
  # gizzi-code-v1.0.2-<target>.tar.gz
  base_url = "https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v#{version}"

  if OS.mac? && Hardware::CPU.arm?
    url "#{base_url}/gizzi-code-v#{version}-darwin-arm64.tar.gz"
    sha256 "5cd930a32f1fbabcf186d54f32db203c8921c6e08c39f6ca5c94abb04435baa2"
  elsif OS.mac? && Hardware::CPU.intel?
    url "#{base_url}/gizzi-code-v#{version}-darwin-x64.tar.gz"
    sha256 "47b8ec4875b69c2ba5ac36c9ad8bce256a2690590ad77330ef5e2757e992730c"
  elsif OS.linux? && Hardware::CPU.arm?
    url "#{base_url}/gizzi-code-v#{version}-linux-arm64.tar.gz"
    sha256 "0bdc5cf9c63afeb365da7eca4cb2fd5d4ddeee65223db6dc4ffbbdd4356703ab"
  elsif OS.linux? && Hardware::CPU.intel?
    url "#{base_url}/gizzi-code-v#{version}-linux-x64.tar.gz"
    sha256 "d1d0743885ffac741aa0c3bcec3ec3860cc2c05b24e984e9b03ffd23a16af835"
  end

  def install
    bin.install "gizzi-code"
    bin.install_symlink "gizzi-code" => "gizzi"
  end

  service do
    run [opt_bin/"gizzi-code", "daemon", "start"]
    keep_alive true
    error_log_path var/"log/gizzi-code/error.log"
    log_path var/"log/gizzi-code/output.log"
    working_dir var/"run/gizzi-code"
  end

  test do
    system "#{bin}/gizzi-code", "--version"
  end
end
