# Auth Contract for Allternit

## Overview
This document describes the authentication contract between UI, gateway, and services to eliminate 401 errors.

## UI Authentication Flow

### How UI Obtains Token/Session
1. User logs in via authentication provider
2. Token is stored in `localStorage` or `sessionStorage` as `auth_token`
3. Token is retrieved in API calls via `localStorage.getItem('auth_token')` or `sessionStorage.getItem('auth_token')`

### Token Format
- Bearer token format: `Bearer <token>`

## Gateway Authentication Forwarding

### Current Gateway (NGINX)
The NGINX gateway configuration (`infra/gateway/nginx.conf`) currently does not forward authentication headers properly. 

### Required Changes
The gateway must forward the Authorization header from the UI to backend services:

```
location /api/v1/ {
    proxy_pass http://kernel_monolith/api/v1/;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;  # Forward auth header
}
```

## Service Authentication Validation

### Expected Headers
Services expect the following header:
- `Authorization: Bearer <token>`

### Validation Mechanism
Services should validate the token against the authentication provider or internal token store.

## Auth Contract Implementation

### UI Client (`apps/shell/src/runtime/ApiClient.ts`)
- Retrieves token from localStorage/sessionStorage
- Adds `Authorization: Bearer <token>` header to requests
- Handles 401 responses appropriately

### Gateway Layer
- Must forward `Authorization` header to upstream services
- Should not modify or strip authentication headers

### Service Layer
- Validate `Authorization` header
- Return appropriate 401 for invalid tokens
- Allow marketplace endpoints to be readable without auth in dev mode

## Development vs Production

### Development Mode
- Marketplace/framework list should be readable without auth
- Write/update operations require auth

### Production Mode
- All endpoints require valid authentication
- Proper RBAC enforcement