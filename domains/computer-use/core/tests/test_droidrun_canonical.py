"""Minimal validation for the DroidRun canonical provider.

These tests do not require a real Android device or ``mobilerun_core`` to be
installed; they exercise the provider's surface area and ensure it reports
itself correctly when the optional runtime is unavailable.
"""

import pytest

from contracts.canonical import OperatingSystem
from core.environment_backends import EnvironmentBackendManifest
from providers.droidrun_canonical import DroidRunCanonicalProvider


@pytest.fixture
def provider():
    return DroidRunCanonicalProvider()


@pytest.mark.asyncio
async def test_capabilities(provider):
    caps = await provider.capabilities()
    assert caps.provider_id == "mobile.droidrun.canonical"
    assert OperatingSystem.ANDROID.value in caps.operating_systems
    assert caps.mobile is True
    assert "tap" in caps.actions
    assert "swipe" in caps.actions
    assert "typeText" in caps.actions
    assert "keypress" in caps.actions
    assert "launchApp" in caps.actions
    assert "shell" in caps.actions
    assert "pushFile" in caps.actions
    assert "pullFile" in caps.actions
    assert "getUiTree" in caps.actions
    assert "plan" in caps.actions


def test_manifest(provider):
    manifest = provider.manifest()
    assert isinstance(manifest, EnvironmentBackendManifest)
    assert manifest.provider_id == "mobile.droidrun.canonical"
    assert "android" in manifest.operating_systems
    assert "host" in manifest.isolations
    assert "mobile" in manifest.capabilities


@pytest.mark.asyncio
async def test_mobile_action_requires_provisioned_environment(provider):
    with pytest.raises(KeyError, match="is not provisioned"):
        await provider.mobile_action("missing-env", "tap", {"x": 100, "y": 200})
