# Homebrew formula for Gizzi Code (binary distribution)
# Usage: brew tap <you>/gizzi && brew install gizzi
#
# NOTE: canonical formula lives in packaging/homebrew/gizzi-code.rb in the
# Gizziio/allternit-platform repo; this copy is for tap distribution.

class GizziCode < Formula
  desc "AI-powered terminal interface and runtime for the Allternit ecosystem"
  homepage "https://docs.gizziio.com"
  version "2.0.5"
  license "MIT"

  # Release tags look like "gizzi-code/v1.0.2"; assets are version-named:
  # gizzi-code-v1.0.2-<target>.tar.gz
  base_url = "https://github.com/Gizziio/allternit-platform/releases/download/gizzi-code/v#{version}"

  if OS.mac? && Hardware::CPU.arm?
    url "#{base_url}/gizzi-code-v#{version}-darwin-arm64.tar.gz"
    sha256 "fb1043461169aa890617c79c6ea85715b187ec56bf9a5d5e4a9e4375a13be66b"
  elsif OS.mac? && Hardware::CPU.intel?
    url "#{base_url}/gizzi-code-v#{version}-darwin-x64.tar.gz"
    sha256 "4a36a1708fe0bc1742812988e0e1622c43bce364790d434d8e89a9f7cd8996d4"
  elsif OS.linux? && Hardware::CPU.arm?
    url "#{base_url}/gizzi-code-v#{version}-linux-arm64.tar.gz"
    sha256 "55cc7d0752a5a004441f6d96c718c591490d5a2fc7369584d0b40c218600fa68"
  elsif OS.linux? && Hardware::CPU.intel?
    url "#{base_url}/gizzi-code-v#{version}-linux-x64.tar.gz"
    sha256 "538e9d63b58e05f8e65bf51245e96953e8feab126dbf13b86ef9446bf94df764"
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
