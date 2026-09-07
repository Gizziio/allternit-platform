import { describe, expect, it } from "vitest";
import {
  isCloudControlPlaneUrl,
  isLoopbackUrl,
  operatorProviderDiscoveryUrl,
  resolveOperatorGatewayUrl,
} from "./operator-gateway";

describe("operator-gateway", () => {
  it("treats api.allternit.com as the cloud control plane", () => {
    expect(isCloudControlPlaneUrl("https://api.allternit.com")).toBe(true);
    expect(isCloudControlPlaneUrl("https://api.allternit.com/api/v1")).toBe(true);
    expect(isCloudControlPlaneUrl("http://127.0.0.1:8013")).toBe(false);
  });

  it("detects loopback operator origins", () => {
    expect(isLoopbackUrl("http://127.0.0.1:8013")).toBe(true);
    expect(isLoopbackUrl("http://localhost:8013")).toBe(true);
    expect(isLoopbackUrl("https://ai.allternit.com")).toBe(false);
  });

  it("keeps desktop operator traffic on loopback even when VITE is cloud", () => {
    expect(
      resolveOperatorGatewayUrl({
        viteUrl: "https://api.allternit.com",
        locationOrigin: "http://127.0.0.1:8013",
        isDesktop: true,
      }),
    ).toBe("http://127.0.0.1:8013");
  });

  it("prefers a remote non-cloud runtime backend on desktop", () => {
    expect(
      resolveOperatorGatewayUrl({
        viteUrl: "https://api.allternit.com",
        locationOrigin: "http://127.0.0.1:8013",
        runtimeGatewayUrl: "http://100.64.1.12:8013",
        isDesktop: true,
      }),
    ).toBe("http://100.64.1.12:8013");
  });

  it("ignores a cloud snapshot as the desktop operator gateway", () => {
    expect(
      resolveOperatorGatewayUrl({
        windowUrl: "https://api.allternit.com",
        viteUrl: "https://api.allternit.com",
        runtimeGatewayUrl: "https://api.allternit.com",
        locationOrigin: "http://127.0.0.1:8013",
        isDesktop: true,
      }),
    ).toBe("http://127.0.0.1:8013");
  });

  it("uses the baked cloud URL on the hosted web", () => {
    expect(
      resolveOperatorGatewayUrl({
        viteUrl: "https://api.allternit.com",
        locationOrigin: "https://ai.allternit.com",
        isDesktop: false,
      }),
    ).toBe("https://api.allternit.com");
  });

  it("never discovers providers against the cloud control plane", () => {
    expect(operatorProviderDiscoveryUrl("https://api.allternit.com")).toBe(
      "/api/v1/providers",
    );
    expect(operatorProviderDiscoveryUrl("http://127.0.0.1:8013")).toBe(
      "/api/v1/providers",
    );
    expect(operatorProviderDiscoveryUrl("http://100.64.1.12:8013")).toBe(
      "http://100.64.1.12:8013/api/v1/providers",
    );
  });
});
