#!/usr/bin/env python3
"""
A2rchitech API Gateway - Canonical Enterprise Implementation

This is the SINGLE entry point for all external traffic to the A2rchitect platform.
All UI and external client requests MUST go through this gateway.

Responsibilities:
    - SSL/TLS Termination (future)
    - Authentication (JWT validation, API key validation)
    - Rate limiting and throttling
    - Request routing to appropriate backend services
    - CORS handling
    - Request/response logging for audit
    - Load balancing (future)

Architecture:
    Client → Gateway (8013) → API Service (3000) → Internal Services

DO NOT add business logic here. This is purely a proxy/routing layer.

@module gateway
@version 2.0.0
"""

import os
import sys
import json
import logging
import time
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import uvicorn
from starlette.middleware.base import BaseHTTPMiddleware

# =============================================================================
# Memory API Models
# =============================================================================

class MemoryQueryRequest(BaseModel):
    question: str
    max_results: int = Field(default=10, ge=1, le=100)
    tenant_id: Optional[str] = None
    session_id: Optional[str] = None

class MemoryIngestRequest(BaseModel):
    content: str
    source: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    tenant_id: Optional[str] = None
    session_id: Optional[str] = None

class MemoryBulkIngestItem(BaseModel):
    content: str
    source: Optional[str] = None

class MemoryBulkIngestRequest(BaseModel):
    items: List[MemoryBulkIngestItem]

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("a2r-gateway")

# =============================================================================
# Configuration
# =============================================================================

GATEWAY_PORT = int(os.environ.get("PORT", "8013"))
GATEWAY_HOST = os.environ.get("HOST", "0.0.0.0")
API_URL = os.environ.get("API_URL", "http://127.0.0.1:3000")
WEBSOCKET_URL = os.environ.get("WEBSOCKET_URL", "http://127.0.0.1:3001")
VOICE_URL = os.environ.get("VOICE_URL", "http://127.0.0.1:8001")
WEBVM_URL = os.environ.get("WEBVM_URL", "http://127.0.0.1:8002")
RAILS_URL = os.environ.get("RAILS_URL", "http://127.0.0.1:3011")
OPERATOR_URL = os.environ.get("OPERATOR_URL", "http://127.0.0.1:3010")
MEMORY_URL = os.environ.get("MEMORY_URL", "http://127.0.0.1:3201")
TERMINAL_URL = os.environ.get("TERMINAL_URL", "http://127.0.0.1:4096")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5177,http://127.0.0.1:5177").split(",")

logger.info(f"Gateway Configuration:")
logger.info(f"  Port: {GATEWAY_PORT}")
logger.info(f"  Host: {GATEWAY_HOST}")
logger.info(f"  API URL: {API_URL}")
logger.info(f"  Terminal URL: {TERMINAL_URL}")
logger.info(f"  Voice URL: {VOICE_URL}")
logger.info(f"  WebVM URL: {WEBVM_URL}")
logger.info(f"  Operator URL: {OPERATOR_URL}")
logger.info(f"  Rails URL: {RAILS_URL}")
logger.info(f"  Memory URL: {MEMORY_URL}")
logger.info(f"  CORS Origins: {CORS_ORIGINS}")

# =============================================================================
# FastAPI App
# =============================================================================

app = FastAPI(
    title="A2rchitect Gateway",
    version="2.0.0",
    description="Enterprise API Gateway for A2rchitect Platform",
    docs_url="/docs" if os.environ.get("DEBUG") else None,
    redoc_url="/redoc" if os.environ.get("DEBUG") else None,
)

# HTTP client for proxying (shared connection pool)
http_client = httpx.AsyncClient(
    timeout=httpx.Timeout(60.0, connect=5.0),
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
)

# =============================================================================
# Middleware
# =============================================================================

class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Validate authentication tokens and add user context to requests.
    
    In production, this should:
    - Validate JWT signatures against JWKS
    - Check token expiration
    - Extract user claims
    - Handle API keys
    """
    
    async def dispatch(self, request: Request, call_next):
        # Skip auth for health checks
        if request.url.path == "/health":
            return await call_next(request)
        
        auth_header = request.headers.get("Authorization")
        
        if not auth_header:
            # Anonymous request
            request.state.user = None
            request.state.tenant_id = "anonymous"
            request.state.auth_method = "none"
        elif auth_header.startswith("Bearer "):
            token = auth_header[7:]
            
            # TODO: Implement proper JWT validation
            # For now, accept any token format for development
            if token == "dev-token" or len(token) > 10:
                request.state.user = {"id": "dev-user", "email": "dev@a2r.local"}
                request.state.tenant_id = "dev-tenant"
                request.state.auth_method = "jwt"
            else:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Invalid token", "code": "INVALID_TOKEN"}
                )
        elif auth_header.startswith("ApiKey "):
            api_key = auth_header[7:]
            # TODO: Validate API key against registry
            request.state.user = {"id": "api-user"}
            request.state.tenant_id = "api-tenant"
            request.state.auth_method = "api_key"
        else:
            return JSONResponse(
                status_code=401,
                content={"error": "Unsupported authentication method", "code": "UNSUPPORTED_AUTH"}
            )
        
        return await call_next(request)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Log all requests for audit trail."""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        response = await call_next(request)
        
        duration = time.time() - start_time
        
        logger.info(
            f"{request.method} {request.url.path} - {response.status_code} - {duration:.3f}s",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration": duration,
                "user": getattr(request.state, "user", None),
                "tenant": getattr(request.state, "tenant_id", None),
            }
        )
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limiting.
    
    In production, use Redis for distributed rate limiting.
    """
    
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, list] = {}
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path == "/health":
            return await call_next(request)
        
        # Get client identifier
        client_id = getattr(request.state, "user", {}).get("id") or request.client.host
        
        now = time.time()
        window_start = now - 60  # 1 minute window
        
        # Clean old requests
        if client_id in self.requests:
            self.requests[client_id] = [
                t for t in self.requests[client_id] if t > window_start
            ]
        else:
            self.requests[client_id] = []
        
        # Check limit
        if len(self.requests[client_id]) >= self.requests_per_minute:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "code": "RATE_LIMIT_EXCEEDED",
                    "retry_after": 60
                }
            )
        
        # Record request
        self.requests[client_id].append(now)
        
        return await call_next(request)


# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Trace-ID"],
)
app.add_middleware(AuthenticationMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=120)

# =============================================================================
# Routes
# =============================================================================

@app.get("/health")
async def health_check():
    """
    Gateway health check.
    
    Returns:
        Status of the gateway and backend services.
    """
    # Check backend health
    backend_status = "unknown"
    try:
        response = await http_client.get(f"{API_URL}/health", timeout=2.0)
        backend_status = "healthy" if response.status_code == 200 else "unhealthy"
    except Exception as e:
        backend_status = f"error: {str(e)}"
    
    return {
        "status": "healthy",
        "service": "gateway",
        "version": "2.0.0",
        "backend": backend_status,
        "timestamp": time.time()
    }


@app.get("/api/health")
async def api_health():
    """Proxy to API health check."""
    try:
        response = await http_client.get(f"{API_URL}/health", timeout=5.0)
        return JSONResponse(
            content=response.json(),
            status_code=response.status_code
        )
    except Exception as e:
        logger.error(f"Backend health check failed: {e}")
        raise HTTPException(status_code=503, detail="Backend service unavailable")


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy(request: Request, path: str):
    """
    Proxy all requests to the appropriate backend service.
    
    Routing Logic:
        /api/v1/*              → API Service (3000)
        /api/v1/voice/*        → Voice Service (8001)
        /api/v1/browser/*      → A2R Operator (3010)
        /api/v1/vision/*       → A2R Operator (3010)
        /api/v1/parallel/*     → A2R Operator (3010)
        /api/v1/operator/*     → A2R Operator (3010)
        /api/v1/plan*          → A2R Rails (3011)
        /api/v1/dags/*         → A2R Rails (3011)
        /api/v1/wihs/*         → A2R Rails (3011)
        /api/v1/leases*        → A2R Rails (3011)
        /api/v1/ledger/*       → A2R Rails (3011)
        /api/v1/index/*        → A2R Rails (3011)
        /api/v1/mail/*         → A2R Rails (3011)
        /api/v1/gate/*         → A2R Rails (3011)
        /api/v1/vault/*        → A2R Rails (3011)
        /api/v1/init           → A2R Rails (3011)
        /webvm/*               → WebVM Bridge (8002)
        /ws/*                  → WebSocket Service (3001) [future]
        /webhook/*             → Webhook Handler [future]
    
    Args:
        request: The incoming request
        path: The path to proxy
    
    Returns:
        Response from the backend service
    """
    
    # Determine target service based on path
    if path.startswith("api/v1/voice/"):
        target_base = VOICE_URL
    elif path.startswith("api/v1/browser/") or path.startswith("api/v1/vision/") or path.startswith("api/v1/parallel/") or path.startswith("api/v1/operator/"):
        target_base = OPERATOR_URL
    elif (path.startswith("api/v1/rails/") or 
          path.startswith("api/v1/plan") or 
          path.startswith("api/v1/dags/") or 
          path.startswith("api/v1/wihs/") or 
          path.startswith("api/v1/leases/") or
          path.startswith("api/v1/ledger/") or
          path.startswith("api/v1/index/") or
          path.startswith("api/v1/mail/") or
          path.startswith("api/v1/gate/") or
          path.startswith("api/v1/vault/") or
          path == "api/v1/leases" or
          path == "api/v1/init" or
          path == "api/v1/gate/check"):
        target_base = RAILS_URL
    elif path.startswith("api/v1/providers") or path == "api/chat" or path.startswith("session/") or path == "session":
        # Route providers, chat, and sessions to Terminal Server (Gizzi Code)
        target_base = TERMINAL_URL
    elif path.startswith("webvm/"):
        target_base = WEBVM_URL
    elif path.startswith("api/"):
        target_base = API_URL
    elif path.startswith("ws/"):
        target_base = WEBSOCKET_URL
    else:
        # Default to API
        target_base = API_URL
    
    # Build target URL
    # Path transformation for Terminal Server
    if target_base == TERMINAL_URL:
        if path.startswith("api/v1/providers"):
            # Transform /api/v1/providers/* to /provider/*
            transformed_path = path.replace("api/v1/providers", "provider", 1)
            # Handle auth endpoint variations
            if transformed_path == "provider/auth/status":
                transformed_path = "provider/auth"
            elif transformed_path.endswith("/auth/status"):
                # Keep as is for specific provider auth status
                transformed_path = transformed_path.replace("/auth/status", "/auth")
            target_url = f"{target_base}/{transformed_path}"
        elif path == "api/chat":
            # Transform /api/chat?chatId=xxx to /session/xxx/message
            chat_id = request.query_params.get("chatId", "")
            if chat_id:
                target_url = f"{target_base}/session/{chat_id}/message"
            else:
                target_url = f"{target_base}/api/chat"
        else:
            target_url = f"{target_base}/{path}"
    else:
        target_url = f"{target_base}/{path}"
    
    if request.query_params and path != "api/chat":
        target_url += f"?{request.query_params}"
    
    # Prepare headers
    headers = {}
    for key, value in request.headers.items():
        # Skip hop-by-hop headers
        if key.lower() in ['host', 'connection', 'keep-alive', 'transfer-encoding']:
            continue
        headers[key] = value
    
    # Add context headers from authentication
    if hasattr(request.state, 'user') and request.state.user:
        headers['x-user-id'] = str(request.state.user.get('id', ''))
        headers['x-user-email'] = str(request.state.user.get('email', ''))
    if hasattr(request.state, 'tenant_id'):
        headers['x-tenant-id'] = str(request.state.tenant_id)
    if hasattr(request.state, 'auth_method'):
        headers['x-auth-method'] = str(request.state.auth_method)
    
    # Add request tracing
    headers['x-request-id'] = request.headers.get('x-request-id', f"req-{int(time.time() * 1000)}")
    headers['x-gateway-version'] = '2.0.0'
    
    # Get request body
    body = await request.body()
    
    try:
        # Make request to backend
        logger.debug(f"Proxying {request.method} {path} to {target_url}")
        
        response = await http_client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body if body else None,
            follow_redirects=True
        )
        
        # Handle streaming responses (SSE - Server-Sent Events)
        content_type = response.headers.get('content-type', '')
        if 'text/event-stream' in content_type:
            return StreamingResponse(
                response.aiter_text(),
                status_code=response.status_code,
                headers={
                    k: v for k, v in response.headers.items()
                    if k.lower() not in ['content-encoding', 'transfer-encoding']
                },
                media_type='text/event-stream'
            )
        
        # Handle JSON responses
        if 'application/json' in content_type:
            return JSONResponse(
                content=response.json(),
                status_code=response.status_code,
                headers={
                    k: v for k, v in response.headers.items()
                    if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']
                }
            )
        
        # Handle other responses
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers={
                k: v for k, v in response.headers.items()
                if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']
            }
        )
        
    except httpx.ConnectError as e:
        logger.error(f"Backend connection error: {e}")
        raise HTTPException(
            status_code=503,
            detail={"error": "Backend service unavailable", "code": "BACKEND_UNAVAILABLE"}
        )
    except httpx.TimeoutException as e:
        logger.error(f"Backend timeout: {e}")
        raise HTTPException(
            status_code=504,
            detail={"error": "Backend timeout", "code": "BACKEND_TIMEOUT"}
        )
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "Internal gateway error", "code": "GATEWAY_ERROR"}
        )


# =============================================================================
# Memory API Routes
# =============================================================================

@app.get("/api/v1/memory/health")
async def memory_health():
    """Check memory agent health"""
    try:
        response = await http_client.get(f"{MEMORY_URL}/health", timeout=5.0)
        return response.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail={"error": "Memory service unavailable", "code": "MEMORY_UNAVAILABLE"}
        )

@app.get("/api/v1/memory/stats")
async def memory_stats():
    """Get memory statistics"""
    try:
        response = await http_client.get(f"{MEMORY_URL}/stats", timeout=5.0)
        return response.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail={"error": "Memory service unavailable", "code": "MEMORY_UNAVAILABLE"}
        )

@app.post("/api/v1/memory/query")
async def memory_query(request: MemoryQueryRequest):
    """Query the memory agent for historical context"""
    try:
        payload = {
            "question": request.question,
            "max_results": request.max_results,
        }
        if request.tenant_id:
            payload["tenant_id"] = request.tenant_id
        if request.session_id:
            payload["session_id"] = request.session_id
            
        response = await http_client.post(
            f"{MEMORY_URL}/api/query",
            json=payload,
            timeout=30.0
        )
        return response.json()
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail={"error": "Memory query timeout", "code": "MEMORY_TIMEOUT"}
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail={"error": "Memory service unavailable", "code": "MEMORY_UNAVAILABLE"}
        )

@app.post("/api/v1/memory/ingest")
async def memory_ingest(request: MemoryIngestRequest):
    """Ingest content into memory"""
    try:
        payload = {
            "content": request.content,
            "source": request.source,
        }
        if request.metadata:
            payload["metadata"] = request.metadata
        if request.tenant_id:
            payload["tenant_id"] = request.tenant_id
        if request.session_id:
            payload["session_id"] = request.session_id
            
        response = await http_client.post(
            f"{MEMORY_URL}/api/ingest",
            json=payload,
            timeout=30.0
        )
        return response.json()
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail={"error": "Memory ingest timeout", "code": "MEMORY_TIMEOUT"}
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail={"error": "Memory service unavailable", "code": "MEMORY_UNAVAILABLE"}
        )

@app.post("/api/v1/memory/ingest/bulk")
async def memory_ingest_bulk(request: MemoryBulkIngestRequest):
    """Bulk ingest multiple items"""
    try:
        payload = {
            "items": [
                {"content": item.content, "source": item.source}
                for item in request.items
            ]
        }
        
        response = await http_client.post(
            f"{MEMORY_URL}/api/ingest/bulk",
            json=payload,
            timeout=60.0
        )
        return response.json()
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail={"error": "Bulk ingest timeout", "code": "MEMORY_TIMEOUT"}
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail={"error": "Memory service unavailable", "code": "MEMORY_UNAVAILABLE"}
        )

@app.get("/api/v1/memory/search")
async def memory_search(q: str, limit: int = 20):
    """Search memories"""
    try:
        response = await http_client.get(
            f"{MEMORY_URL}/api/search",
            params={"q": q, "limit": limit},
            timeout=10.0
        )
        return response.json()
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail={"error": "Search timeout", "code": "MEMORY_TIMEOUT"}
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail={"error": "Memory service unavailable", "code": "MEMORY_UNAVAILABLE"}
        )

@app.get("/api/v1/memory/recent")
async def memory_recent(limit: int = 10):
    """Get recent memories"""
    try:
        response = await http_client.get(
            f"{MEMORY_URL}/api/recent",
            params={"limit": limit},
            timeout=10.0
        )
        return response.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail={"error": "Memory service unavailable", "code": "MEMORY_UNAVAILABLE"}
        )

@app.get("/api/v1/memory/insights")
async def memory_insights():
    """Get all insights"""
    try:
        response = await http_client.get(f"{MEMORY_URL}/api/insights", timeout=10.0)
        return response.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail={"error": "Memory service unavailable", "code": "MEMORY_UNAVAILABLE"}
        )

@app.post("/api/v1/memory/consolidate")
async def memory_consolidate():
    """Trigger manual consolidation"""
    try:
        response = await http_client.post(
            f"{MEMORY_URL}/api/consolidate",
            timeout=60.0
        )
        return response.json()
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail={"error": "Consolidation timeout", "code": "MEMORY_TIMEOUT"}
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail={"error": "Memory service unavailable", "code": "MEMORY_UNAVAILABLE"}
        )

@app.delete("/api/v1/memory/{memory_id}")
async def memory_delete(memory_id: str):
    """Delete a memory"""
    try:
        response = await http_client.delete(
            f"{MEMORY_URL}/api/memory/{memory_id}",
            timeout=10.0
        )
        return response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail={"error": "Memory not found", "code": "NOT_FOUND"}
            )
        raise
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail={"error": "Memory service unavailable", "code": "MEMORY_UNAVAILABLE"}
        )


# =============================================================================
# Lifecycle Events
# =============================================================================

@app.on_event("startup")
async def startup():
    """Initialize gateway."""
    logger.info("Gateway starting up...")
    
    # Verify backend connectivity
    try:
        response = await http_client.get(f"{API_URL}/health", timeout=5.0)
        if response.status_code == 200:
            logger.info("Backend API is reachable")
        else:
            logger.warning(f"Backend API returned status {response.status_code}")
    except Exception as e:
        logger.warning(f"Backend API not reachable: {e}")
        logger.warning("Gateway will continue to start, but requests may fail")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup gateway."""
    logger.info("Gateway shutting down...")
    await http_client.aclose()


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    logger.info(f"Starting A2rchitect Gateway on {GATEWAY_HOST}:{GATEWAY_PORT}")
    uvicorn.run(
        app,
        host=GATEWAY_HOST,
        port=GATEWAY_PORT,
        log_level="info",
        access_log=True
    )
