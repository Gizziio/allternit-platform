import { Auth } from "@/runtime/integrations/auth/auth";
import { Server } from "@/runtime/server/server";
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
const app = Server.App();
const platform = Bun.serve({
    port: 0,
    fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/.well-known/gizzi") {
            return Response.json({
                auth: {
                    env: "GIZZI_PLATFORM_TOKEN",
                },
            });
        }
        if (url.pathname === "/terminal/clerk") {
            return new Response("bridge ok");
        }
        return new Response("not found", { status: 404 });
    },
});
const platformURL = platform.url.origin;
try {
    const startResponse = await app.request("/auth/terminal/clerk/start", {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({
            platformURL,
        }),
    });
    assert(startResponse.ok, `start failed: ${startResponse.status}`);
    const start = (await startResponse.json());
    assert(start.sessionID, "missing session id");
    assert(start.status === "pending", `expected pending start status, got ${start.status}`);
    const pendingResponse = await app.request(`/auth/terminal/clerk/poll/${encodeURIComponent(start.sessionID)}`);
    assert(pendingResponse.ok, `pending poll failed: ${pendingResponse.status}`);
    const pending = (await pendingResponse.json());
    assert(pending.status === "pending", `expected pending poll status, got ${pending.status}`);
    const callbackURL = new URL(start.callbackURL);
    const callbackResponse = await app.request(`${callbackURL.pathname}${callbackURL.search}`, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token: "test-clerk-session-token" }),
    });
    assert(callbackResponse.ok, `callback failed: ${callbackResponse.status}`);
    const completedResponse = await app.request(`/auth/terminal/clerk/poll/${encodeURIComponent(start.sessionID)}`);
    assert(completedResponse.ok, `completed poll failed: ${completedResponse.status}`);
    const completed = (await completedResponse.json());
    assert(completed.status === "completed", `expected completed status, got ${completed.status}`);
    const claimResponse = await app.request(`/auth/terminal/clerk/claim/${encodeURIComponent(start.sessionID)}`, {
        method: "POST",
    });
    assert(claimResponse.ok, `claim failed: ${claimResponse.status}`);
    const claim = (await claimResponse.json());
    assert(claim.status === "claimed", `expected claimed status, got ${claim.status}`);
    assert(claim.providerID === platformURL, "provider id mismatch");
    assert(claim.envKey === "GIZZI_PLATFORM_TOKEN", "env key mismatch");
    const auth = await Auth.get(platformURL);
    assert(auth?.type === "wellknown", "expected persisted wellknown auth");
    assert(auth?.key === "GIZZI_PLATFORM_TOKEN", "persisted key mismatch");
    assert(auth?.token === "test-clerk-session-token", "persisted token mismatch");
    console.log("terminal clerk e2e: PASS");
}
finally {
    await Auth.remove(platformURL).catch(() => { });
    await platform.stop();
}
