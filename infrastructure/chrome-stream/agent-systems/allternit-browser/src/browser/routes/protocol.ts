import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import {
  ActionIntentSchema,
  ExecutionLeaseSchema,
} from '@allternit/computer-use-protocol';
import type { createBrowserRouteContext } from '../server-context.js';
import { BrowserRunController } from '../../protocol/run-controller.js';
import { LocalPlaywrightProvider } from '../../protocol/local-provider.js';
import { compileBrowserTrajectoryToSkill } from '../../protocol/skill-factory.js';

const StartRunBodySchema = z.object({
  accountId: z.string().min(1).default('local'),
  conversationId: z.string().min(1).default('browser'),
  objective: z.string().min(1),
  provider: z.enum(['local-playwright', 'extension-tab', 'browser-use', 'stagehand']).default('local-playwright'),
  startedBy: z.enum(['platform-web', 'desktop', 'gizzi', 'extension', 'api']).default('api'),
  sessionId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  deviceId: z.string().min(1).optional(),
  profile: z.string().min(1).optional(),
  targetId: z.string().min(1).optional(),
});

const ExecuteBodySchema = z.object({
  lease: z.unknown(),
  action: z.unknown(),
});

const CompleteBodySchema = z.object({
  reason: z.string().min(1).optional(),
});

const CompileSkillBodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

const localProvider = new LocalPlaywrightProvider();
const controller = new BrowserRunController({
  providers: [localProvider],
  sourceSurface: 'api',
});

export function registerBrowserProtocolRoutes(
  app: Express,
  ctx: ReturnType<typeof createBrowserRouteContext>,
): void {
  app.get('/v1/browser-runs/providers', (_req: Request, res: Response) => {
    res.json({ providers: controller.listProviders().map((provider) => provider.capabilities) });
  });

  app.post('/v1/browser-runs', async (req: Request, res: Response) => {
    await route(res, async () => {
      const body = StartRunBodySchema.parse(req.body ?? {});
      const profileCtx = ctx.resolveProfileContext(
        { query: { profile: body.profile }, body: { profile: body.profile } },
        res,
        ctx,
      );
      if (!profileCtx) return;

      const tab = await profileCtx.ensureTabAvailable(body.targetId);
      const started = controller.startRun(body);
      if (body.provider === 'local-playwright') {
        localProvider.bind({
          sessionId: started.session.sessionId,
          cdpUrl: profileCtx.profile.cdpUrl,
          targetId: tab.targetId,
        });
      }
      res.status(201).json({ ...started, tab });
    });
  });

  app.get('/v1/browser-runs/:runId', (req: Request, res: Response) => {
    routeSync(res, () => {
      const run = controller.getRun(req.params.runId);
      if (!run) return res.status(404).json({ error: 'Run not found' });
      res.json({
        run,
        lease: controller.getLease(run.runId),
        session: controller.getSession(run.sessionId),
      });
    });
  });

  app.get('/v1/browser-runs/:runId/events', (req: Request, res: Response) => {
    routeSync(res, () => {
      const after = typeof req.query.after === 'string' ? Number(req.query.after) : 0;
      res.json({ events: controller.eventsAfter(req.params.runId, Number.isFinite(after) ? after : 0) });
    });
  });

  app.post('/v1/browser-runs/:runId/observe', async (req: Request, res: Response) => {
    await route(res, async () => {
      const result = await controller.observe(req.params.runId);
      res.json(result);
    });
  });

  app.post('/v1/browser-runs/:runId/actions', async (req: Request, res: Response) => {
    await route(res, async () => {
      const body = ExecuteBodySchema.parse(req.body ?? {});
      const lease = ExecutionLeaseSchema.parse(body.lease);
      const action = ActionIntentSchema.parse(body.action);
      if (action.runId !== req.params.runId) {
        res.status(400).json({ error: 'Action runId does not match route runId' });
        return;
      }
      const result = await controller.execute({ lease, action });
      res.json(result);
    });
  });

  app.post('/v1/browser-runs/:runId/complete', (req: Request, res: Response) => {
    routeSync(res, () => {
      const _body = CompleteBodySchema.parse(req.body ?? {});
      res.json(controller.completeRun(req.params.runId));
    });
  });

  app.post('/v1/browser-runs/:runId/cancel', (req: Request, res: Response) => {
    routeSync(res, () => {
      const body = CompleteBodySchema.parse(req.body ?? {});
      res.json(controller.cancelRun(req.params.runId, body.reason ?? 'cancelled by caller'));
    });
  });

  app.post('/v1/browser-runs/:runId/skill', (req: Request, res: Response) => {
    routeSync(res, () => {
      const body = CompileSkillBodySchema.parse(req.body ?? {});
      const trajectory = controller.toTrajectory(req.params.runId);
      res.json(compileBrowserTrajectoryToSkill(trajectory, body));
    });
  });
}

async function route(res: Response, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    sendError(res, error);
  }
}

function routeSync(res: Response, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    sendError(res, error);
  }
}

function sendError(res: Response, error: unknown): void {
  if (res.headersSent) return;
  res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
}
