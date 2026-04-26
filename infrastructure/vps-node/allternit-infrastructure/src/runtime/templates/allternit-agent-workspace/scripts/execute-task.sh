#!/bin/bash
# ============================================================================
# Allternit Agent Workspace - Task Execution Script
# Executes agent tasks in a sandboxed environment with timeout and monitoring
# ============================================================================

set -euo pipefail

# Configuration
readonly AGENT_ID="${AGENT_ID:-default}"
readonly WORKSPACE_DIR="/home/agent/workspace"
readonly TASK_TIMEOUT="${TASK_TIMEOUT:-3600}"  # Default 1 hour
readonly MAX_OUTPUT_SIZE="${MAX_OUTPUT_SIZE:-104857600}"  # 100MB
readonly SANDBOX_ENABLED="${SANDBOX_ENABLED:-true}"
readonly FIREJAIL_PROFILE="${FIREJAIL_PROFILE:-allternit-agent}"

# Task tracking
TASK_ID=""
TASK_START_TIME=""
TASK_PID=""
OUTPUT_FILE=""
ARTIFACTS_DIR=""

# Logging
log() {
    local level="$1"
    shift
    echo "[$(date -Iseconds)] [$level] [execute-task] $*" >&2
}

info() { log "INFO" "$@"; }
warn() { log "WARN" "$@"; }
error() { log "ERROR" "$@"; }
die() { error "$@"; exit 1; }

# ============================================================================
# Usage and Help
# ============================================================================
usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] [TASK_FILE]

Execute an agent task in a sandboxed environment.

OPTIONS:
    -t, --timeout SECONDS       Task timeout (default: 3600)
    -i, --task-id ID           Task identifier (auto-generated if not provided)
    -o, --output FILE          Output file for results
    -s, --script SCRIPT        Execute a script file
    -c, --command CMD          Execute a shell command
    -p, --python CODE          Execute Python code
    -n, --node CODE            Execute Node.js code
    -j, --json JSON            Task specification as JSON string
    --no-sandbox               Disable sandbox (security risk)
    -h, --help                 Show this help message

EXAMPLES:
    # Execute task from JSON file
    $(basename "$0") task.json

    # Execute command with 5 minute timeout
    $(basename "$0") -t 300 -c "python3 script.py"

    # Execute Python code
    $(basename "$0") -p "print('Hello, World!')"

    # Execute with custom task ID
    $(basename "$0") -i task-001 -s /path/to/script.sh

ENVIRONMENT:
    AGENT_ID            Agent identifier
    TASK_TIMEOUT        Default timeout in seconds
    SANDBOX_ENABLED     Enable/disable sandbox (default: true)
    WORKSPACE_DIR       Working directory for tasks
EOF
}

# ============================================================================
# Parse Arguments
# ============================================================================
parse_args() {
    TASK_FILE=""
    TASK_SCRIPT=""
    TASK_COMMAND=""
    TASK_PYTHON=""
    TASK_NODE=""
    TASK_JSON=""
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -t|--timeout)
                TASK_TIMEOUT="$2"
                shift 2
                ;;
            -i|--task-id)
                TASK_ID="$2"
                shift 2
                ;;
            -o|--output)
                OUTPUT_FILE="$2"
                shift 2
                ;;
            -s|--script)
                TASK_SCRIPT="$2"
                shift 2
                ;;
            -c|--command)
                TASK_COMMAND="$2"
                shift 2
                ;;
            -p|--python)
                TASK_PYTHON="$2"
                shift 2
                ;;
            -n|--node)
                TASK_NODE="$2"
                shift 2
                ;;
            -j|--json)
                TASK_JSON="$2"
                shift 2
                ;;
            --no-sandbox)
                SANDBOX_ENABLED="false"
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            -*)
                die "Unknown option: $1"
                ;;
            *)
                TASK_FILE="$1"
                shift
                ;;
        esac
    done
    
    # Generate task ID if not provided
    if [[ -z "${TASK_ID}" ]]; then
        TASK_ID="task-$(date +%Y%m%d-%H%M%S)-$(tr -dc 'a-z0-9' < /dev/urandom | head -c 8)"
    fi
    
    # Set default output file
    if [[ -z "${OUTPUT_FILE}" ]]; then
        OUTPUT_FILE="${WORKSPACE_DIR}/output/${TASK_ID}.json"
    fi
    
    # Create artifacts directory
    ARTIFACTS_DIR="${WORKSPACE_DIR}/output/${TASK_ID}-artifacts"
    mkdir -p "${ARTIFACTS_DIR}"
}

# ============================================================================
# Read Task from JSON
# ============================================================================
read_task_json() {
    local input="$1"
    
    # Read from file or stdin
    if [[ "$input" == "-" ]]; then
        cat
    elif [[ -f "$input" ]]; then
        cat "$input"
    else
        echo "$input"
    fi
}

# ============================================================================
# Parse Task JSON
# ============================================================================
parse_task() {
    local task_json="$1"
    
    # Extract task fields using jq
    TASK_TYPE=$(echo "$task_json" | jq -r '.type // "shell"')
    TASK_NAME=$(echo "$task_json" | jq -r '.name // "unnamed-task"')
    TASK_DESCRIPTION=$(echo "$task_json" | jq -r '.description // ""')
    
    # Extract timeout if specified
    local specified_timeout
    specified_timeout=$(echo "$task_json" | jq -r '.timeout // empty')
    if [[ -n "$specified_timeout" ]]; then
        TASK_TIMEOUT="$specified_timeout"
    fi
    
    # Extract command/code based on type
    case "$TASK_TYPE" in
        shell|command|bash)
            TASK_COMMAND=$(echo "$task_json" | jq -r '.command // .script // empty')
            ;;
        python)
            TASK_PYTHON=$(echo "$task_json" | jq -r '.code // .script // empty')
            ;;
        node|javascript|js)
            TASK_NODE=$(echo "$task_json" | jq -r '.code // .script // empty')
            ;;
        script)
            TASK_SCRIPT=$(echo "$task_json" | jq -r '.path // .script // empty')
            ;;
        *)
            die "Unknown task type: $TASK_TYPE"
            ;;
    esac
    
    # Extract environment variables
    TASK_ENV=$(echo "$task_json" | jq -r '.env // {}')
    
    info "Parsed task: ${TASK_NAME} (type: ${TASK_TYPE})"
}

# ============================================================================
# Prepare Execution Environment
# ============================================================================
prepare_environment() {
    # Set task-specific environment variables
    export TASK_ID
    export TASK_START_TIME=$(date -Iseconds)
    export TASK_ARTIFACTS_DIR="${ARTIFACTS_DIR}"
    export TASK_OUTPUT_FILE="${OUTPUT_FILE}"
    
    # Create temp directory for this task
    export TASK_TEMP_DIR="${WORKSPACE_DIR}/temp/${TASK_ID}"
    mkdir -p "${TASK_TEMP_DIR}"
    
    # Apply task-specific environment
    if [[ -n "${TASK_ENV:-}" ]]; then
        while IFS='=' read -r key value; do
            key=$(echo "$key" | tr -d '"')
            value=$(echo "$value" | tr -d '"')
            export "$key=$value"
        done < <(echo "$TASK_ENV" | jq -r 'to_entries | map("\(.key)=\(.value)") | .[]')
    fi
}

# ============================================================================
# Build Execution Command
# ============================================================================
build_command() {
    local cmd=""
    
    if [[ -n "${TASK_COMMAND}" ]]; then
        cmd="${TASK_COMMAND}"
    elif [[ -n "${TASK_PYTHON}" ]]; then
        # Write Python code to temp file and execute
        local py_file="${TASK_TEMP_DIR}/script.py"
        echo "${TASK_PYTHON}" > "$py_file"
        cmd="python3.11 '$py_file'"
    elif [[ -n "${TASK_NODE}" ]]; then
        # Write Node.js code to temp file and execute
        local js_file="${TASK_TEMP_DIR}/script.js"
        echo "${TASK_NODE}" > "$js_file"
        cmd="node '$js_file'"
    elif [[ -n "${TASK_SCRIPT}" ]]; then
        if [[ -f "${TASK_SCRIPT}" ]]; then
            cmd="bash '${TASK_SCRIPT}'"
        else
            die "Script file not found: ${TASK_SCRIPT}"
        fi
    elif [[ -n "${TASK_FILE}" && -f "${TASK_FILE}" ]]; then
        # Task file provided as argument
        parse_task "$(cat "${TASK_FILE}")"
        build_command
        return
    else
        die "No task command specified"
    fi
    
    echo "$cmd"
}

# ============================================================================
# Execute with Sandbox
# ============================================================================
execute_with_sandbox() {
    local cmd="$1"
    local output_log="${TASK_TEMP_DIR}/stdout.log"
    local error_log="${TASK_TEMP_DIR}/stderr.log"
    
    if [[ "${SANDBOX_ENABLED}" == "true" ]] && command -v firejail &> /dev/null; then
        info "Executing with Firejail sandbox"
        
        local firejail_opts=""
        
        # Add profile if exists
        if [[ -f "/etc/firejail/${FIREJAIL_PROFILE}.profile" ]]; then
            firejail_opts="--profile=${FIREJAIL_PROFILE}"
        else
            firejail_opts="--noprofile"
        fi
        
        # Sandbox restrictions
        firejail_opts="${firejail_opts} \
            --private-tmp \
            --private-dev \
            --read-only=/ \
            --read-write=${WORKSPACE_DIR} \
            --read-write=${TASK_TEMP_DIR} \
            --read-write=/tmp \
            --rlimit-cpu=${TASK_TIMEOUT} \
            --rlimit-as=$((4 * 1024 * 1024 * 1024)) \
            --rlimit-fsize=${MAX_OUTPUT_SIZE} \
            --rlimit-nproc=1000 \
            --netfilter \
            --nosound \
            --novideo \
            --quiet"
        
        # Execute with firejail
        firejail ${firejail_opts} -- bash -c "${cmd}" \
            > >(tee "${output_log}") 2> >(tee "${error_log}" >&2) &
        TASK_PID=$!
    else
        info "Executing without sandbox (security risk)"
        
        # Apply resource limits via ulimit
        (
            ulimit -t "${TASK_TIMEOUT}"
            ulimit -v $((4 * 1024 * 1024))
            ulimit -f $((100 * 1024))
            ulimit -u 1000
            bash -c "${cmd}"
        ) > >(tee "${output_log}") 2> >(tee "${error_log}" >&2) &
        TASK_PID=$!
    fi
}

# ============================================================================
# Monitor Execution
# ============================================================================
monitor_execution() {
    local start_time=$(date +%s)
    local end_time=$((start_time + TASK_TIMEOUT))
    local exit_code=0
    
    info "Task started: PID=${TASK_PID}, Timeout=${TASK_TIMEOUT}s"
    
    # Wait for completion with timeout
    while true; do
        if ! kill -0 ${TASK_PID} 2>/dev/null; then
            # Process finished
            wait ${TASK_PID}
            exit_code=$?
            break
        fi
        
        local current_time=$(date +%s)
        if [[ ${current_time} -gt ${end_time} ]]; then
            warn "Task timeout reached after ${TASK_TIMEOUT}s"
            kill -TERM ${TASK_PID} 2>/dev/null || true
            sleep 2
            kill -KILL ${TASK_PID} 2>/dev/null || true
            exit_code=124  # Timeout exit code
            break
        fi
        
        # Check output size
        local output_size
        output_size=$(stat -f%z "${TASK_TEMP_DIR}/stdout.log" 2>/dev/null || stat -c%s "${TASK_TEMP_DIR}/stdout.log" 2>/dev/null || echo 0)
        if [[ ${output_size} -gt ${MAX_OUTPUT_SIZE} ]]; then
            warn "Output size limit exceeded"
            kill -TERM ${TASK_PID} 2>/dev/null || true
            exit_code=125
            break
        fi
        
        sleep 1
    done
    
    return ${exit_code}
}

# ============================================================================
# Collect Artifacts
# ============================================================================
collect_artifacts() {
    info "Collecting artifacts..."
    
    # Copy files from temp directory to artifacts
    if [[ -d "${TASK_TEMP_DIR}" ]]; then
        find "${TASK_TEMP_DIR}" -type f ! -name "*.log" -exec cp {} "${ARTIFACTS_DIR}/" \; 2>/dev/null || true
    fi
    
    # List artifacts
    local artifacts=()
    while IFS= read -r -d '' file; do
        artifacts+=("$(basename "$file")")
    done < <(find "${ARTIFACTS_DIR}" -type f -print0 2>/dev/null || true)
    
    echo "${artifacts[@]}"
}

# ============================================================================
# Generate Output Report
# ============================================================================
generate_report() {
    local exit_code="$1"
    local end_time=$(date -Iseconds)
    local duration=$(($(date +%s) - $(date -d "${TASK_START_TIME}" +%s)))
    
    # Determine status
    local status
    case "${exit_code}" in
        0) status="completed" ;;
        124) status="timeout" ;;
        125) status="output_limit_exceeded" ;;
        137) status="killed" ;;
        *) status="failed" ;;
    esac
    
    # Read output logs
    local stdout_content=""
    local stderr_content=""
    if [[ -f "${TASK_TEMP_DIR}/stdout.log" ]]; then
        stdout_content=$(cat "${TASK_TEMP_DIR}/stdout.log" | head -c 100000 | jq -Rs '.')
    fi
    if [[ -f "${TASK_TEMP_DIR}/stderr.log" ]]; then
        stderr_content=$(cat "${TASK_TEMP_DIR}/stderr.log" | head -c 50000 | jq -Rs '.')
    fi
    
    # Collect artifacts
    local artifacts_json
    artifacts_json=$(collect_artifacts | jq -R 'split(" ") | map(select(length > 0))')
    
    # Generate report
    cat > "${OUTPUT_FILE}" << EOF
{
  "task_id": "${TASK_ID}",
  "agent_id": "${AGENT_ID}",
  "status": "${status}",
  "exit_code": ${exit_code},
  "timing": {
    "started_at": "${TASK_START_TIME}",
    "completed_at": "${end_time}",
    "duration_seconds": ${duration}
  },
  "output": {
    "stdout": ${stdout_content:-'""'},
    "stderr": ${stderr_content:-'""'}
  },
  "artifacts": {
    "directory": "${ARTIFACTS_DIR}",
    "files": ${artifacts_json:-'[]'}
  },
  "resources": {
    "timeout_seconds": ${TASK_TIMEOUT},
    "max_output_size": ${MAX_OUTPUT_SIZE}
  }
}
EOF
    
    info "Task completed: status=${status}, exit_code=${exit_code}, duration=${duration}s"
    info "Output written to: ${OUTPUT_FILE}"
}

# ============================================================================
# Cleanup
# ============================================================================
cleanup() {
    info "Cleaning up..."
    
    # Kill any remaining processes
    if [[ -n "${TASK_PID}" ]] && kill -0 ${TASK_PID} 2>/dev/null; then
        kill -TERM ${TASK_PID} 2>/dev/null || true
        sleep 1
        kill -KILL ${TASK_PID} 2>/dev/null || true
    fi
    
    # Clean up temp directory (optional - keep for debugging)
    # rm -rf "${TASK_TEMP_DIR}"
    
    info "Cleanup complete"
}

# ============================================================================
# Main Execution
# ============================================================================
main() {
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Parse arguments
    parse_args "$@"
    
    info "Starting task execution: ${TASK_ID}"
    
    # Read task from stdin if no other source specified
    if [[ -z "${TASK_COMMAND}" && -z "${TASK_PYTHON}" && -z "${TASK_NODE}" && -z "${TASK_SCRIPT}" && -z "${TASK_FILE}" && -n "${TASK_JSON}" ]]; then
        parse_task "${TASK_JSON}"
    elif [[ -z "${TASK_COMMAND}" && -z "${TASK_PYTHON}" && -z "${TASK_NODE}" && -z "${TASK_SCRIPT}" && -n "${TASK_FILE}" ]]; then
        parse_task "$(read_task_json "${TASK_FILE}")"
    fi
    
    # Prepare environment
    prepare_environment
    
    # Build command
    local cmd
    cmd=$(build_command)
    
    info "Executing: ${cmd:0:100}..."
    
    # Execute with monitoring
    execute_with_sandbox "$cmd"
    monitor_execution
    local exit_code=$?
    
    # Generate report
    generate_report "$exit_code"
    
    return $exit_code
}

# Run main function
main "$@"
