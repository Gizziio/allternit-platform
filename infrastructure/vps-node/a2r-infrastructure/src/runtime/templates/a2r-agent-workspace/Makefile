# ============================================================================
# A2R Agent Workspace - Makefile
# Convenient commands for managing the agent workspace
# ============================================================================

.PHONY: help build start stop restart logs shell clean test health

# Default target
.DEFAULT_GOAL := help

# Variables
COMPOSE_FILE := docker-compose.yml
PROJECT_NAME := a2r-agent

# Colors for output
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

help: ## Show this help message
	@echo "$(BLUE)A2R Agent Workspace - Available Commands$(RESET)"
	@echo "=========================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(RESET) %s\n", $$1, $$2}'

build: ## Build all Docker images
	@echo "$(BLUE)Building A2R Agent Workspace images...$(RESET)"
	docker-compose -f $(COMPOSE_FILE) build

start: ## Start the agent workspace
	@echo "$(GREEN)Starting A2R Agent Workspace...$(RESET)"
	docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)Agent workspace is running!$(RESET)"
	@echo "Health check: http://localhost:3000/health"

start-fg: ## Start in foreground mode (for debugging)
	@echo "$(BLUE)Starting A2R Agent Workspace (foreground)...$(RESET)"
	docker-compose -f $(COMPOSE_FILE) up

stop: ## Stop the agent workspace
	@echo "$(YELLOW)Stopping A2R Agent Workspace...$(RESET)"
	docker-compose -f $(COMPOSE_FILE) down

restart: stop start ## Restart the agent workspace

logs: ## View container logs
	docker-compose -f $(COMPOSE_FILE) logs -f

logs-agent: ## View agent workspace logs only
	docker-compose -f $(COMPOSE_FILE) logs -f agent-workspace

shell: ## Open a shell in the agent container
	docker-compose -f $(COMPOSE_FILE) exec agent-workspace /bin/bash

exec: ## Execute a command in the agent container (usage: make exec CMD="ls -la")
	docker-compose -f $(COMPOSE_FILE) exec agent-workspace $(CMD)

health: ## Check agent health status
	@echo "$(BLUE)Checking agent health...$(RESET)"
	@curl -s http://localhost:3000/health | jq . || echo "$(RED)Health check failed$(RESET)"

status: ## Show detailed agent status
	@echo "$(BLUE)Agent Status:$(RESET)"
	@curl -s http://localhost:3000/status | jq . || echo "$(RED)Status check failed$(RESET)"

tools: ## List available tools
	@echo "$(BLUE)Available Tools:$(RESET)"
	@curl -s http://localhost:3000/tools | jq . || echo "$(RED)Tools check failed$(RESET)"

resources: ## Show resource usage
	@echo "$(BLUE)Resource Usage:$(RESET)"
	@curl -s http://localhost:3000/resources | jq . || echo "$(RED)Resource check failed$(RESET)"

test: ## Run basic tests
	@echo "$(BLUE)Running basic tests...$(RESET)"
	@echo "1. Testing health endpoint..."
	@curl -sf http://localhost:3000/health > /dev/null && echo "$(GREEN)✓ Health check passed$(RESET)" || echo "$(RED)✗ Health check failed$(RESET)"
	@echo "2. Testing browser availability..."
	@docker-compose -f $(COMPOSE_FILE) exec -T agent-workspace which chromium-browser > /dev/null && echo "$(GREEN)✓ Chromium available$(RESET)" || echo "$(RED)✗ Chromium not found$(RESET)"
	@echo "3. Testing Python..."
	@docker-compose -f $(COMPOSE_FILE) exec -T agent-workspace python3.11 --version && echo "$(GREEN)✓ Python available$(RESET)" || echo "$(RED)✗ Python not found$(RESET)"
	@echo "4. Testing Node.js..."
	@docker-compose -f $(COMPOSE_FILE) exec -T agent-workspace node --version && echo "$(GREEN)✓ Node.js available$(RESET)" || echo "$(RED)✗ Node.js not found$(RESET)"

clean: ## Clean up containers and volumes
	@echo "$(YELLOW)Cleaning up...$(RESET)"
	docker-compose -f $(COMPOSE_FILE) down -v
	docker system prune -f

clean-all: ## Clean up everything including images
	@echo "$(RED)Cleaning up everything...$(RESET)"
	docker-compose -f $(COMPOSE_FILE) down -v --rmi all
	docker system prune -af

task-shell: ## Execute a shell command task
	@read -p "Enter command: " cmd; \
	docker-compose -f $(COMPOSE_FILE) exec -T agent-workspace execute-task -c "$$cmd"

task-python: ## Execute Python code
	@read -p "Enter Python code: " code; \
	docker-compose -f $(COMPOSE_FILE) exec -T agent-workspace execute-task -p "$$code"

task-file: ## Execute task from JSON file
	@read -p "Enter task file path: " file; \
	docker-compose -f $(COMPOSE_FILE) exec -T agent-workspace execute-task "$$file"

ps: ## Show running containers
	docker-compose -f $(COMPOSE_FILE) ps

update: ## Update Docker images to latest versions
	@echo "$(BLUE)Pulling latest images...$(RESET)"
	docker-compose -f $(COMPOSE_FILE) pull
	docker-compose -f $(COMPOSE_FILE) up -d

monitor: ## Start with resource monitoring enabled
	@echo "$(BLUE)Starting with monitoring...$(RESET)"
	docker-compose -f $(COMPOSE_FILE) --profile monitoring up -d

# Development commands
dev-build: ## Build for development (no cache)
	docker-compose -f $(COMPOSE_FILE) build --no-cache

dev-shell: ## Open root shell for debugging (development only)
	docker-compose -f $(COMPOSE_FILE) exec --user root agent-workspace /bin/bash
