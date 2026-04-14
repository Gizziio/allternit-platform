class A2rBackend < Formula
  desc "A2R Backend Server - Self-hosted AI platform"
  homepage "https://a2r.dev"
  version "1.0.0"
  
  if OS.mac? && Hardware::CPU.intel?
    url "https://github.com/a2r/backend/releases/download/v1.0.0/a2r-backend-1.0.0-x86_64-macos.tar.gz"
    sha256 "PLACEHOLDER_SHA256_X86_64_MACOS"
  elsif OS.mac? && Hardware::CPU.arm?
    url "https://github.com/a2r/backend/releases/download/v1.0.0/a2r-backend-1.0.0-aarch64-macos.tar.gz"
    sha256 "PLACEHOLDER_SHA256_AARCH64_MACOS"
  elsif OS.linux? && Hardware::CPU.intel?
    url "https://github.com/a2r/backend/releases/download/v1.0.0/a2r-backend-1.0.0-x86_64-linux.tar.gz"
    sha256 "PLACEHOLDER_SHA256_X86_64_LINUX"
  elsif OS.linux? && Hardware::CPU.arm?
    url "https://github.com/a2r/backend/releases/download/v1.0.0/a2r-backend-1.0.0-aarch64-linux.tar.gz"
    sha256 "PLACEHOLDER_SHA256_AARCH64_LINUX"
  end
  
  license "MIT"
  
  depends_on "openssl"
  
  def install
    # Install binaries
    bin.install "bin/a2r-api"
    bin.install "bin/a2r-kernel" if File.exist?("bin/a2r-kernel")
    bin.install "bin/a2r-memory" if File.exist?("bin/a2r-memory")
    bin.install "bin/a2r-workspace" if File.exist?("bin/a2r-workspace")
    
    # Install web assets
    (var/"a2r/web").mkpath
    (var/"a2r/web").install Dir["web/*"] if Dir.exist?("web")
    
    # Create config directory
    (etc/"a2r").mkpath
    
    # Install default config if not present
    unless (etc/"a2r/backend.yaml").exist?
      (etc/"a2r/backend.yaml").write config_file
    end
    
    # Create data and log directories
    (var/"lib/a2r").mkpath
    (var/"log/a2r").mkpath
  end
  
  def config_file
    <<~EOS
      server:
        host: 127.0.0.1
        port: 4096
      
      database:
        type: sqlite
        path: #{var}/lib/a2r/a2r.db
      
      storage:
        data_dir: #{var}/lib/a2r
        logs_dir: #{var}/log/a2r
      
      logging:
        level: info
        file: #{var}/log/a2r/a2r.log
    EOS
  end
  
  service do
    run [opt_bin/"a2r-api"]
    environment_variables A2R_CONFIG: etc/"a2r/backend.yaml"
    keep_alive true
    log_path var/"log/a2r/service.log"
    error_log_path var/"log/a2r/error.log"
  end
  
  def post_install
    # Set permissions
    (var/"lib/a2r").mkpath
    (var/"log/a2r").mkpath
  end
  
  def caveats
    <<~EOS
      A2R Backend has been installed!
      
      To start the service:
        brew services start a2r-backend
      
      Or run manually:
        a2r-api --config #{etc}/a2r/backend.yaml
      
      Configuration file:
        #{etc}/a2r/backend.yaml
      
      Data directory:
        #{var}/lib/a2r
      
      Connect your A2R Desktop to:
        http://localhost:4096
      
      For more information:
        https://docs.a2r.dev
    EOS
  end
  
  test do
    system "#{bin}/a2r-api", "--version"
  end
end
