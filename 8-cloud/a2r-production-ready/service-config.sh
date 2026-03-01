# =============================================================================
# A2RCHITECH PLATFORM - SERVICE CONFIGURATION
# =============================================================================
# Source this file to load all service port configurations
# Usage: source ./dev/scripts/service-config.sh
# =============================================================================

# -----------------------------------------------------------------------------
# Core Platform Services (3000-3099)
# -----------------------------------------------------------------------------
export A2R_API_PORT=3000
export A2R_POLICY_PORT=3003
export A2R_KERNEL_PORT=3004
export A2R_OPERATOR_PORT=3010
export A2R_RAILS_PORT=3011
export A2R_LINK_CARD_PORT=3090

# -----------------------------------------------------------------------------
# AI/ML Services (8000-8009)
# -----------------------------------------------------------------------------
export A2R_VOICE_PORT=8001
export A2R_WEBVM_PORT=8002
export A2R_BROWSER_RUNTIME_PORT=8003

# -----------------------------------------------------------------------------
# Gateway Services (8010-8019)
# -----------------------------------------------------------------------------
export A2R_AGUI_PORT=8010
export A2R_A2A_PORT=8012
export A2R_GATEWAY_PORT=8013

# -----------------------------------------------------------------------------
# Infrastructure Services (3200-3299)
# -----------------------------------------------------------------------------
export A2R_MEMORY_PORT=3200
export A2R_REGISTRY_PORT=8080

# -----------------------------------------------------------------------------
# Terminal & Shell (4096-5199)
# -----------------------------------------------------------------------------
export A2R_TERMINAL_PORT=4096
export A2R_SHELL_UI_PORT=5177

# -----------------------------------------------------------------------------
# Third-Party Integration
# -----------------------------------------------------------------------------
export OPENCLAW_PORT=18789

# -----------------------------------------------------------------------------
# Service URLs (constructed from ports)
# -----------------------------------------------------------------------------
export A2R_API_URL="http://127.0.0.1:${A2R_API_PORT}"
export A2R_KERNEL_URL="http://127.0.0.1:${A2R_KERNEL_PORT}"
export A2R_POLICY_URL="http://127.0.0.1:${A2R_POLICY_PORT}"
export A2R_MEMORY_URL="http://127.0.0.1:${A2R_MEMORY_PORT}"
export A2R_REGISTRY_URL="http://127.0.0.1:${A2R_REGISTRY_PORT}"
export A2R_VOICE_URL="http://127.0.0.1:${A2R_VOICE_PORT}"
export A2R_WEBVM_URL="http://127.0.0.1:${A2R_WEBVM_PORT}"
export A2R_OPERATOR_URL="http://127.0.0.1:${A2R_OPERATOR_PORT}"
export A2R_RAILS_URL="http://127.0.0.1:${A2R_RAILS_PORT}"
export A2R_GATEWAY_URL="http://127.0.0.1:${A2R_GATEWAY_PORT}"
export A2R_AGUI_URL="http://127.0.0.1:${A2R_AGUI_PORT}"
export A2R_A2A_URL="http://127.0.0.1:${A2R_A2A_PORT}"
export A2R_TERMINAL_URL="http://127.0.0.1:${A2R_TERMINAL_PORT}"

# -----------------------------------------------------------------------------
# All Ports Array (for cleanup)
# -----------------------------------------------------------------------------
export A2R_ALL_PORTS="${A2R_API_PORT} ${A2R_POLICY_PORT} ${A2R_KERNEL_PORT} ${A2R_OPERATOR_PORT} ${A2R_RAILS_PORT} ${A2R_VOICE_PORT} ${A2R_WEBVM_PORT} ${A2R_AGUI_PORT} ${A2R_A2A_PORT} ${A2R_GATEWAY_PORT} ${A2R_MEMORY_PORT} ${A2R_REGISTRY_PORT} ${A2R_TERMINAL_PORT} ${A2R_SHELL_UI_PORT} ${OPENCLAW_PORT}"
