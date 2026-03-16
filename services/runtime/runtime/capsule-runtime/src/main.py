import json
import hashlib
import os
import sys
import logging
import jsonschema
import uuid
import datetime
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import uvicorn
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("capsule-runtime")

CAPSULE_REGISTRY_PATH = "capsules/capsule_registry.json"
RECEIPT_SCHEMA_PATH = "spec/Contracts/CapsuleReceipt.schema.json"

class ToolCallRequest(BaseModel):
    tool_id: str
    arguments: Dict[str, Any]

class CapsuleRuntime:
    def __init__(self):
        self.registry: Dict[str, Any] = {}
        self.receipt_schema: Dict[str, Any] = {}
        self.run_id: str = os.environ.get("A2R_RUN_ID", "dev-session")
        self.load_registry()
        self.load_receipt_schema()
        
        self.receipt_dir = f".a2r/receipts/{self.run_id}"
        os.makedirs(self.receipt_dir, exist_ok=True)

    def load_registry(self):
        if not os.path.exists(CAPSULE_REGISTRY_PATH):
            logger.critical(f"Capsule registry missing at {CAPSULE_REGISTRY_PATH}")
            sys.exit(1)
        try:
            with open(CAPSULE_REGISTRY_PATH, 'r') as f:
                self.registry = json.load(f)
        except Exception as e:
            logger.critical(f"Failed to read registry: {e}")
            sys.exit(1)

    def load_receipt_schema(self):
        if os.path.exists(RECEIPT_SCHEMA_PATH):
            with open(RECEIPT_SCHEMA_PATH, 'r') as f:
                self.receipt_schema = json.load(f)

    def get_capsule(self, capsule_id: str) -> Optional[Dict[str, Any]]:
        for cap in self.registry.get("capsules", []):
            if cap["capsule_id"] == capsule_id:
                return cap
        return None

    def check_tool_permission(self, capsule_id: str, tool_id: str) -> tuple[bool, str]:
        cap = self.get_capsule(capsule_id)
        if not cap:
            return False, "Capsule not found"
        
        perms = cap.get("permissions", {})
        allowlist = perms.get("tool_allowlist", [])
        
        if tool_id not in allowlist:
            return False, f"Tool '{tool_id}' not in allowlist"
            
        return True, ""

    def emit_receipt(self, capsule_id: str, action: str, status: str, details: Dict[str, Any] = None):
        receipt_id = str(uuid.uuid4())
        path = os.path.join(self.receipt_dir, f"capsule-{receipt_id}.json")
        
        receipt = {
            "receipt_id": receipt_id,
            "created_at": datetime.datetime.utcnow().isoformat() + "Z",
            "run_id": self.run_id,
            "capsule_id": capsule_id,
            "action": action,
            "status": status,
            "trace_id": str(uuid.uuid4()) # simple trace
        }
        if details:
            receipt["details"] = details
            
        # Optional: Validate
        if self.receipt_schema:
            try:
                jsonschema.validate(instance=receipt, schema=self.receipt_schema)
            except Exception as e:
                logger.error(f"Receipt validation failed: {e}")

        try:
            with open(path, 'w') as f:
                json.dump(receipt, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to write receipt: {e}")

runtime = CapsuleRuntime()
app = FastAPI()

@app.post("/v1/capsule/{capsule_id}/tool_call")
async def execute_tool(capsule_id: str, request: ToolCallRequest):
    allowed, reason = runtime.check_tool_permission(capsule_id, request.tool_id)
    
    if not allowed:
        runtime.emit_receipt(capsule_id, "tool_call", "denied", {"tool_id": request.tool_id, "reason": reason})
        raise HTTPException(status_code=403, detail=reason)

    # Mock execution - usually would call Kernel ToolGateway
    runtime.emit_receipt(capsule_id, "tool_call", "success", {"tool_id": request.tool_id})
    return {"status": "success", "result": "mock_output"}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    # Allow port via arg or env
    port = int(os.environ.get("PORT", 3006))
    host = os.environ.get("HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port)
