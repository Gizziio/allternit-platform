.PHONY: help build clean dev test logs stop install-deps api

help:
	@echo "Allternit Development Commands"
	@echo ""
	@echo "Available targets:"
	@echo "  make build          - Build main release binaries in the workspace"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make dev            - Start the Rust API in dev mode"
	@echo "  make api            - Start allternit-api on :8013 (dev auth bypass enabled)"
	@echo "  make stop           - Stop all services"
	@echo "  make logs           - Tail all service logs"
	@echo "  make test           - Run workspace tests"
	@echo "  make install-deps   - Install Python dependencies for voice service"
	@echo ""
	@echo "Quick start:"
	@echo "  make api            # Start allternit-api in dev mode"
	@echo "  make build          # Build release binaries"

api:
	@./dev/scripts/start-api.sh

build:
	cargo build --release --bin allternit-platform
	cargo build --release --bin allternit-api
	cargo build --release --bin voice-service
	cargo build --release --bin allternit-tools-gateway

dev:
	@./dev/scripts/start-api.sh

clean:
	cargo clean
	rm -rf services/voice/api/.venv
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

stop:
	pkill -f "allternit-api" || true
	pkill -f "voice-service" || true
	pkill -f "allternit-platform" || true
	pkill -f "allternit-tools-gateway" || true
	pkill -f "vite" || true

logs:
	@echo "API Service:"
	@tail -f /tmp/allternit-api.log || echo "  (not running)"

test:
	cargo test --workspace

install-deps:
	cd services/voice/api && python3 -m venv .venv
	cd services/voice/api && . .venv/bin/activate && pip install --quiet -r requirements.txt
	cd services/voice/api && touch .venv/installed

rebuild: clean build
