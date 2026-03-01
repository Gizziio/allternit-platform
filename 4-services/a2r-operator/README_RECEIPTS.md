# A2R Receipt Generation System

## Overview
The A2R Operator now includes comprehensive receipt generation functionality as part of the G0501 task "A2R Receipt Generation in a2r-operator". This system generates immutable receipts that comply with the A2R Receipt schema for all desktop control operations.

## Features
- Full compliance with `spec/Contracts/Receipt.schema.json`
- Local storage of receipts in `/.a2r/receipts/` directory
- Submission of receipts to governance kernel
- REST API endpoint to retrieve receipts by ID
- Hash-based integrity verification for inputs and outputs
- Artifact manifest generation for captured screenshots

## Receipt Schema Compliance
The generated receipts include all required fields from the canonical receipt schema:
- `receipt_id`: Unique identifier for the receipt
- `created_at`: ISO-8601 timestamp
- `run_id`: Associated run identifier
- `workflow_id`: Workflow identifier
- `node_id`: Node identifier
- `wih_id`: Work-in-hand identifier
- `tool_id`: Tool identifier
- `tool_def_hash`: Hash of the tool definition
- `input_hashes` and `output_hashes`: Content integrity verification
- `artifact_manifest`: List of generated artifacts
- And many more fields as defined in the schema

## API Endpoints
- `POST /v1/sessions/{session_id}/vision/execute` - Execute vision-based desktop control with receipt generation
- `GET /v1/receipts/{receipt_id}` - Retrieve a specific receipt by ID
- `GET /health` - Health check endpoint

## Usage
When executing desktop control operations through the vision operator, receipts are automatically generated and stored. The receipt ID is returned in the response, and the full receipt details are available via the GET endpoint.

## Storage
Receipts are stored locally in JSON format under the `/.a2r/receipts/` directory with filenames following the pattern `{receipt_id}.json`.

## Governance Integration
Receipts are automatically submitted to the governance kernel at `http://localhost:3004/v1/governance/receipts` for centralized tracking and verification.