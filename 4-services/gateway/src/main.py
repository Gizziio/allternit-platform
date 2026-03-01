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
from typing import Optional, Dict, Any
from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import uvicorn
from starlette.middleware.base import BaseHTTPMiddleware

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
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5177,http://127.0.0.1:5177").split(",")

logger.info(f"Gateway Configuration:")
logger.info(f"  Port: {GATEWAY_PORT}")
logger.info(f"  Host: {GATEWAY_HOST}")
logger.info(f"  API URL: {API_URL}")
logger.info(f"  Voice URL: {VOICE_URL}")
logger.info(f"  WebVM URL: {WEBVM_URL}")
logger.info(f"  Operator URL: {OPERATOR_URL}")
logger.info(f"  Rails URL: {RAILS_URL}")
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
    target_url = f"{target_base}/{path}"
    if request.query_params:
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
