#!/usr/bin/env bash
#
# Install the Allternit Cloud Scheduler as an always-on service.
# This script asks for explicit permission before installing a background service.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../" && pwd)"
BINARY_SRC="$REPO_ROOT/target/release/allternit-scheduler"
BINARY_DST="/usr/local/bin/allternit-scheduler"

ask_yes_no() {
    local prompt="$1"
    while true; do
        read -rp "$prompt [y/N]: " answer
        case "$answer" in
            [Yy]* ) return 0;;
            [Nn]* | "" ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

echo "Allternit Cloud Scheduler installer"
echo "==================================="
echo ""
echo "This will install a background service that runs scheduled tasks"
echo "even when the Allternit Desktop app is closed."
echo ""

if ! ask_yes_no "Do you want to install the Allternit Cloud Scheduler?"; then
    echo "Skipped. Cloud scheduling will not be available."
    exit 0
fi

if [[ ! -f "$BINARY_SRC" ]]; then
    echo "Release binary not found. Building..."
    cd "$REPO_ROOT"
    cargo build --release -p allternit-scheduler
fi

echo "Installing binary to $BINARY_DST..."
sudo cp "$BINARY_SRC" "$BINARY_DST"
sudo chmod +x "$BINARY_DST"

OS="$(uname -s)"
case "$OS" in
    Linux)
        ENV_FILE="/etc/allternit-scheduler/env"
        sudo mkdir -p /etc/allternit-scheduler

        if [[ ! -f "$ENV_FILE" ]]; then
            echo "Creating default environment file at $ENV_FILE..."
            sudo tee "$ENV_FILE" <<'EOF'
ALLTERNIT_SCHEDULER_DATABASE_URL=sqlite:///var/lib/allternit/allternit-cloud.db
ALLTERNIT_SCHEDULER_API_URL=http://127.0.0.1:3001
ALLTERNIT_SCHEDULER_API_KEY=REPLACE_ME
ALLTERNIT_SCHEDULER_POLL_INTERVAL_SECS=60
ALLTERNIT_SCHEDULER_EXECUTION_MODE=api
EOF
        fi

        echo "Installing systemd service..."
        sudo cp "$REPO_ROOT/infrastructure/scheduler/services/allternit-scheduler.service" /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable allternit-scheduler

        echo ""
        echo "Service installed but not started."
        echo "Edit $ENV_FILE with your real database URL and API key, then run:"
        echo "  sudo systemctl start allternit-scheduler"
        ;;

    Darwin)
        PLIST_SRC="$REPO_ROOT/infrastructure/scheduler/services/com.allternit.scheduler.plist"
        PLIST_DST="$HOME/Library/LaunchAgents/com.allternit.scheduler.plist"

        echo "Installing launchd user agent..."
        mkdir -p "$HOME/Library/LaunchAgents"
        sed -e "s|REPLACE_ME|$USER|g" "$PLIST_SRC" > "$PLIST_DST"

        echo ""
        echo "User agent installed to $PLIST_DST"
        echo "Edit the plist to set your real database URL and API key, then run:"
        echo "  launchctl load $PLIST_DST"
        echo "  launchctl start com.allternit.scheduler"
        ;;

    *)
        echo "Unsupported OS: $OS"
        echo "Binary installed at $BINARY_DST. You will need to configure your own service manager."
        exit 1
        ;;
esac

echo ""
echo "Done. See docs/cloud-scheduler-setup.md for details."
