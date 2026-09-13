"""BYOC cloud-credential live validation ("Test Connection" in the Settings
UI). Reachable directly from the browser (same pattern as
computer_use_router/canonical_router -- see computer-use-engine.ts's direct
fetch() calls to this gateway's loopback port) rather than proxied through
cmd/allternit-api, because the secret being tested hasn't been saved/sealed
anywhere yet: it's still sitting in the add-credential form, and validating
it doesn't need anything the Rust side owns.
"""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from core.cloud_provisioning import validate_credential

router = APIRouter(prefix="/v1/cloud-credentials", tags=["cloud-credentials"])


class ValidateCredentialRequest(BaseModel):
    provider: Literal["aws", "gcp", "azure"]
    region: Optional[str] = None
    external_id: Optional[str] = None
    secret: Dict[str, Any]


class ValidateCredentialResponse(BaseModel):
    success: bool
    message: str
    identity: Optional[Dict[str, Any]] = None


@router.post("/test", response_model=ValidateCredentialResponse)
async def test_credential(body: ValidateCredentialRequest) -> ValidateCredentialResponse:
    try:
        identity = await validate_credential(body.provider, body.secret, body.region, body.external_id)
        return ValidateCredentialResponse(success=True, message="Connection verified.", identity=identity)
    except Exception as exc:  # noqa: BLE001 -- surface the real provider error back to the user
        return ValidateCredentialResponse(success=False, message=str(exc))
