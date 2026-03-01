# RLM UI Integration Guide

This document describes how to integrate RLM (Recursive Language Model) functionality into your UI, regardless of the framework used.

The RLM implementation uses a **REPL (Read-Eval-Print Loop) control plane** for long-context management, where:

- The root model operates in a Python REPL environment with access to context slicing functions
- Context is loaded as a variable in the REPL environment for the root model to manipulate
- The root model generates code to slice context and delegate to sub-models
- Results are aggregated programmatically in the REPL environment
- This preserves the core RLM paradigm while integrating with existing systems

## Available API Endpoints

### 1. RLM Execution Endpoint
- **URL**: `/api/rlm/execute` (POST)
- **Description**: Execute a task using RLM context slicing and delegation via REPL control plane
- **Request Body**:
```json
{
  "task": "string - Description of the task to perform",
  "context": "string - Context for the model to work with (loaded into REPL as variable)",
  "mode": "string - Execution mode ('standard', 'rlm', 'hybrid')",
  "model_id": "string - Model identifier for strict allowlist enforcement",
  "max_recursion_depth": "number - Maximum recursion depth (optional)",
  "context_slice_size": "number - Size of context slices in bytes (optional)"
}
```
- **Response**:
```json
{
  "result": "string - The execution result",
  "execution_mode": "string - The mode that was used",
  "processing_steps": [
    {
      "step": "string - Description of the processing step",
      "input_size": "number - Size of input in bytes",
      "output_size": "number - Size of output in bytes",
      "processing_time_ms": "number - Processing time in milliseconds"
    }
  ],
  "metrics": {
    "total_processing_time_ms": "number - Total processing time",
    "total_tokens_processed": "number - Total tokens processed",
    "recursion_depth_used": "number - Recursion depth used",
    "context_slices": "number - Number of context slices processed"
  }
}
```

### 2. RLM Configuration Endpoints
- **Get Config**: `/api/rlm/config` (GET)
- **Update Config**: `/api/rlm/config` (PUT)
- **Request Body for Update**:
```json
{
  "max_recursion_depth": "number - Maximum recursion depth (optional)",
  "context_slice_size": "number - Size of context slices in bytes (optional)",
  "enable_rlm_mode": "boolean - Whether RLM mode is enabled (optional)"
}
```

### 3. RLM Health Check
- **URL**: `/api/rlm/health` (GET)
- **Response**:
```json
{
  "status": "string - Health status ('healthy')",
  "service": "string - Service name ('rlm')",
  "timestamp": "number - Unix timestamp"
}
```

## UI Integration Points

### 1. Mode Selection UI
Create UI elements to allow users to select between execution modes:
- Standard Mode: Direct model execution with full context
- RLM Mode: Context slicing and recursive processing for long-horizon tasks
- Hybrid Mode: Automatic selection based on context characteristics

### 2. Context Visualization UI
Display context information differently based on the selected mode:
- In Standard Mode: Show full context as a single block
- In RLM Mode: Show context slices with size indicators and positions
- In Hybrid Mode: Show context analysis information

### 3. Execution Metrics UI
Display performance metrics returned by the API:
- Processing time
- Tokens processed
- Recursion depth used
- Number of context slices
- Estimated cost

### 4. Configuration UI
Allow users to configure RLM-specific settings:
- Maximum recursion depth
- Context slice size
- Enable/disable RLM mode

## Authentication
All RLM endpoints respect the existing authentication system. Include appropriate authentication headers (typically `Authorization: Bearer <token>`) with requests.

## Error Handling
Handle API errors appropriately:
- 400: Bad request (validation errors)
- 401/403: Authentication/authorization errors (including allowlist denials)
- 404: Resource not found
- 500: Internal server errors

## Example Integration Flow

1. User selects execution mode (standard/rlm/hybrid)
2. User provides task description and context
3. UI calls `/api/rlm/execute` with appropriate parameters
4. UI displays results and metrics
5. UI optionally shows context visualization based on mode
6. User can adjust configuration via `/api/rlm/config`

## Framework Agnostic Implementation

The API endpoints are framework-agnostic and can be integrated with any UI framework (React, Vue, Angular, vanilla JavaScript, etc.) by making standard HTTP requests to the endpoints described above.
