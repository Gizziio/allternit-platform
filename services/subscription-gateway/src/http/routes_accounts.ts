// /v1/accounts — connect placeholder (real browser flows are P3). Connect
// creates the row with session_health: auth_required and a needs_user ledger
// entry. Bots never hold accounts:manage — enforced at token issue (§A6.2).
import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { providerIdSchema, type Account } from "@allternit/subscription-fabric-contracts";
import { getAccount, listAccounts, upsertAccount } from "../store/queries.js";
import { callerOf, requireScope, type GatewayDeps } from "./server.js";

const connectSchema = z.object({
  account_id: z.string().min(1).optional(),
  provider: providerIdSchema,
  label: z.string().min(1),
  plan: z.string().nullable().optional(),
});

export function accountsRouter(deps: GatewayDeps): Router {
  const router = Router();

  router.get("/v1/accounts", requireScope("accounts:manage"), (_req: Request, res: Response) => {
    res.json(listAccounts(deps.db));
  });

  router.get(
    "/v1/accounts/:id/status",
    requireScope("accounts:manage", "tasks:read"),
    (req: Request, res: Response) => {
      const account = getAccount(deps.db, req.params.id);
      if (!account) {
        res.status(404).json({ error: "account_not_found", account_id: req.params.id });
        return;
      }
      res.json({
        account_id: account.account_id,
        session_health: account.session_health,
        enabled: account.enabled,
        plan: account.plan,
      });
    }
  );

  router.post("/v1/accounts", requireScope("accounts:manage"), (req: Request, res: Response) => {
    const parsed = connectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_account", detail: parsed.error.issues });
      return;
    }
    const caller = callerOf(req);
    const accountId = parsed.data.account_id ?? randomUUID();
    const account: Account = {
      account_id: accountId,
      provider: parsed.data.provider,
      label: parsed.data.label,
      plan: parsed.data.plan ?? null,
      plan_observed_at: null,
      profile_ref: `profiles/${accountId}`,
      session_health: "auth_required",
      enabled: true,
    };
    upsertAccount(deps.db, account);
    // Account-scoped ledger entry; the events table is task-keyed, so the
    // synthetic task_id is `account:<id>` (documented in the notes).
    deps.log.append({
      task_id: `account:${account.account_id}`,
      kind: "needs_user",
      payload: {
        account_id: account.account_id,
        reason: "auth",
        message: `Account "${account.label}" needs an interactive login in the Sessions window`,
      },
      callers: [caller.caller_id],
    });
    res.status(201).json(account);
  });

  router.post(
    "/v1/accounts/:id/disconnect",
    requireScope("accounts:manage"),
    (req: Request, res: Response) => {
      const account = getAccount(deps.db, req.params.id);
      if (!account) {
        res.status(404).json({ error: "account_not_found", account_id: req.params.id });
        return;
      }
      upsertAccount(deps.db, { ...account, enabled: false });
      res.json(getAccount(deps.db, req.params.id));
    }
  );

  return router;
}
