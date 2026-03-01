.PHONY: help build clean dev test logs stop install-deps shell-ui agent-shell

help:
	@echo "A2rchitech Development Commands"
	@echo ""
	@echo "Available targets:"
	@echo "  make build          - Build all release binaries"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make dev            - Start all services (voice, webvm, kernel, shell UI)"
	@echo "  make agent-shell    - Start agent-shell TUI (one command!)"
	@echo "  make shell-ui       - Start only shell UI"
	@echo "  make stop           - Stop all services"
	@echo "  make logs           - Tail all service logs"
	@echo "  make test           - Run integration tests"
	@echo "  make install-deps   - Install Python dependencies for voice service"
	@echo ""
	@echo "Quick start:"
	@echo "  make agent-shell    # Start the agent TUI"
	@echo "  ./dev/run.sh        # Start all services"

build:
	cargo build --release --bin a2rchitech
	cargo build --release --bin voice-service
	cargo build --release --bin webvm-service
	cargo build --release --bin kernel

shell-ui:
	cd apps/shell
	npm install
	npm run build

agent-shell:
	@7-apps/agent-shell-acp-adapter/agent-shell

dev:
	./dev/run.sh

clean:
	cargo clean
	rm -rf 4-services/ai/voice-service/api/.venv
	rm -rf 4-services/ai/voice-service/api/.venv
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -type d -exec rm -rf {} +

dev:
	./dev/run.sh

stop:
	pkill -f "uvicorn main:app" || true
	pkill -f "webvm-service" || true
	pkill -f "kernel" || true
	pkill -f "vite" || true

logs:
	@echo "Voice Service:"
	@tail -f logs/voice-service.log || echo "  (not running)"
	@echo ""
	@echo "WebVM Service:"
	@tail -f logs/webvm-service.log || echo "  (not running)"
	@echo ""
	@echo "Kernel Service:"
	@tail -f logs/kernel.log || echo "  (not running)"
	@echo ""
	@echo "Shell UI:"
	@tail -f logs/shell-ui.log || echo "  (not running)"

test:
	cargo test --workspace

install-deps:
	cd 4-services/ai/voice-service/api
	python3 -m venv .venv
	.venv/bin/activate
	pip install --quiet -r requirements.txt
	touch .venv/installed

install-deps-cuda:
	cd 4-services/ai/voice-service/api
	python3 -m venv .venv
	.venv/bin/activate
	pip install --quiet -r requirements-cuda.txt
	touch .venv/installed

webvm-build:
	cd services/compute/webvm
	npm run build

rebuild: clean build
