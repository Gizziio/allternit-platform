import { afterEach, describe, expect, it, vi } from "vitest";
import { usePermissionStore, type PendingPermissionRequest } from "@/lib/agents/permission-store";
import {
  optionIdToReply,
  pendingToFoldEvent,
  replyBotApproval,
} from "./bot-approval-bridge";

const sample: PendingPermissionRequest = {
  requestId: "perm-1",
  sessionId: "sess-1",
  surface: "chat",
  permission: "bash",
  patterns: ["ls -la"],
  metadata: { summary: "Run terminal command" },
  always: [],
  createdAt: "2026-09-11T00:00:00.000Z",
};

afterEach(() => {
  usePermissionStore.setState({
    pendingPermissions: {},
    permissionHistory: [],
    allowedPermissions: {},
  });
  vi.unstubAllGlobals();
});

describe("optionIdToReply", () => {
  it("maps deny to reject, allow to once, grant to always", () => {
    expect(optionIdToReply("deny")).toBe("reject");
    expect(optionIdToReply("approve")).toBe("once");
    expect(optionIdToReply("allow")).toBe("once");
    expect(optionIdToReply("approve", true)).toBe("always");
  });
});

describe("pendingToFoldEvent", () => {
  it("does not invent a grantKey", () => {
    const event = pendingToFoldEvent(sample, { id: "bot-1", name: "Gizzi" });
    expect(event.type).toBe("approval.requested");
    if (event.type !== "approval.requested") return;
    expect(event.approval.grantKey).toBeUndefined();
    expect(event.approval.id).toBe("perm-1");
    expect(event.approval.title).toBe("Run terminal command");
  });
});

describe("replyBotApproval", () => {
  it("calls replyPermission when the id is in the store", () => {
    usePermissionStore.getState().addPermissionRequest(sample);
    const event = replyBotApproval("perm-1", "deny");
    expect(event).toEqual({
      type: "approval.resolved",
      id: "perm-1",
      outcome: "denied",
    });
    expect(usePermissionStore.getState().pendingPermissions["perm-1"]).toBeUndefined();
    expect(usePermissionStore.getState().permissionHistory[0]?.decision).toBe("reject");
  });

  it("POSTs cowork when the id is not in the store", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    replyBotApproval("gate-9", "allow");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/cowork/approvals");
    expect(JSON.parse(init.body)).toEqual({ actionId: "gate-9", decision: "approved" });
  });
});
