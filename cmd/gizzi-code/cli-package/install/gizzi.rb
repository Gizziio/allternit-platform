# Homebrew formula for Gizzi Code (binary distribution)
# Usage: brew tap <you>/gizzi && brew install gizzi
#
# NOTE: canonical formula lives in packaging/homebrew/gizzi-code.rb in the
# Gizziio/allternit-platform repo; this copy is for tap distribution.

class GizziCode < Formula
  desc "AI-powered terminal interface and runtime for the Allternit ecosystem"
  homepage "https://docs.gizziio.com"
  version "2.0.3"
  license "MIT"

  # Release tags look like "gizzi-code/v1.0.2"; assets are version-named:
  # gizzi-code-v1.0.2-<target>.tar.gz
  base_url = "https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v#{version}"

  if OS.mac? && Hardware::CPU.arm?
    url "#{base_url}/gizzi-code-v#{version}-darwin-arm64.tar.gz"
    sha256 "d9b9345a48330fb6e26f22773bc3c34d8ff531746eba589fa048a4ac1a86dc85"
  elsif OS.mac? && Hardware::CPU.intel?
    url "#{base_url}/gizzi-code-v#{version}-darwin-x64.tar.gz"
    sha256 "f736401de754953a1348f3813c0b3ecab8d18de7f0434162a31b0e0962d55fc9"
  elsif OS.linux? && Hardware::CPU.arm?
    url "#{base_url}/gizzi-code-v#{version}-linux-arm64.tar.gz"
    sha256 "365a1c7b3af881ec997b4c6bf2689184a84c39bbfaa106ad040eeaf0583def81"
  elsif OS.linux? && Hardware::CPU.intel?
    url "#{base_url}/gizzi-code-v#{version}-linux-x64.tar.gz"
    sha256 "b5e41173e9aa2be97128c2ef33fbec1679e03092a7dd86651d418f0281ef7bf0"
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
