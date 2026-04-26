from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import sys
import os
import io
import contextlib
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("python-gateway")

app = FastAPI(title="Allternitchitech Python Gateway")

class ExecuteRequest(BaseModel):
    code: str
    context_length: int
    session_id: str

class ExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    output: Optional[Dict[str, Any]]
    exit_code: int

@app.post("/v1/tools/execute", response_model=ExecuteResponse)
async def execute_code(request: ExecuteRequest):
    """
    Python execution is disabled by default. Use ToolGateway with WIH + approvals.
    """
    logger.warning("Python gateway execute disabled; request rejected.")
    raise HTTPException(status_code=403, detail="python-gateway exec disabled; use ToolGateway with WIH + approval")
    

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
