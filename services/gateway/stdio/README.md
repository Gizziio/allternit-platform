# IO Bridge (stdio NDJSON-RPC)

The IO Bridge provides a communication interface using standard input/output (stdio) to transmit Newline Delimited JSON (NDJSON) formatted Remote Procedure Call (RPC) messages. This enables language-agnostic inter-process communication following the JSON-RPC 2.0 specification.

## Purpose

The IO Bridge serves as a transport mechanism that allows external processes to communicate with the A2rchitech system through standard input/output streams. It follows the JSON-RPC 2.0 protocol for structured communication.

## Architecture

The IO Bridge operates as a continuous loop that:
1. Reads NDJSON lines from stdin
2. Parses each line as an RPC request
3. Processes the request using a handler
4. Sends the response back via stdout as NDJSON

## Protocol

The bridge uses JSON-RPC 2.0 over NDJSON (Newline Delimited JSON):

### Request Format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "method_name",
  "params": { /* optional parameters */ }
}
```

### Response Format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { /* result data */ },
  "error": null
}
```

Or in case of error:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": null,
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

## Supported Methods

- `ping` - Returns "pong" to test connectivity
- `echo` - Returns the input parameters
- `health` - Returns system health information

## Usage

To use the IO Bridge, send NDJSON-formatted RPC requests to stdin. The bridge will respond with NDJSON-formatted RPC responses on stdout.

Example:
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "ping", "params": null}' | cargo run --bin gateway-stdio
```

## Implementation Details

The IO Bridge is implemented as an asynchronous Rust service that:
- Uses Tokio for async runtime
- Implements the JSON-RPC 2.0 specification
- Follows NDJSON format for message framing
- Provides extensible handler system for custom methods
- Includes error handling and logging