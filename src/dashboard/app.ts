import express, { type Express, type Request, type Response } from 'express';
import type { AppConfig } from '../config/config.js';
import type { CredentialRepository } from '../repositories/credentialRepository.js';
import type { RunRepository } from '../repositories/runRepository.js';
import { istParts } from '../shared/time.js';

interface DashboardDependencies {
  config: AppConfig & { portal: AppConfig['portal'] & { accountId: string } };
  credentials: CredentialRepository;
  runs: RunRepository;
  ping: () => Promise<boolean>;
}

export function createDashboard(dependencies: DashboardDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    const secret = dependencies.config.dashboard.authSecret;
    if (secret && request.get('authorization') !== `Bearer ${secret}`) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });
  app.get('/api/status', async (_request: Request, response: Response) => {
    const [databaseHealthy, metadata, runs] = await Promise.all([
      dependencies.ping().catch(() => false),
      dependencies.credentials.metadata(dependencies.config.portal.accountId),
      dependencies.runs.recent(25),
    ]);
    const now = new Date();
    const today = istParts(now).dateKey;
    const todayRuns = runs.filter((run) => istParts(run.startedAt).dateKey === today);
    response.json({
      generatedAt: now,
      timezone: dependencies.config.timezone,
      automationEnabled: dependencies.config.automationEnabled,
      dryRun: dependencies.config.dryRun,
      selectorsVerified: dependencies.config.portal.selectorsVerified,
      databaseHealthy,
      credential: metadata
        ? {
            credentialVersion: metadata.credentialVersion,
            rotationStatus: metadata.rotationStatus,
            rotatedAt: metadata.rotatedAt,
            updatedAt: metadata.updatedAt,
          }
        : null,
      today: {
        dateKey: today,
        punchIn: todayRuns.find((run) => run.action === 'PUNCH_IN') ?? null,
        punchOut: todayRuns.find((run) => run.action === 'PUNCH_OUT') ?? null,
      },
      recentRuns: runs,
      missedRuns: detectMissedRuns(now, runs, dependencies.config),
    });
  });
  app.get('/', (_request: Request, response: Response) => {
    response.type('html').send(html);
  });
  return app;
}

function detectMissedRuns(
  now: Date,
  runs: Awaited<ReturnType<RunRepository['recent']>>,
  config: AppConfig,
) {
  const current = istParts(now);
  if (current.weekday === 0 || current.weekday === 6) return [];
  const missed: string[] = [];
  const todayRuns = runs.filter((run) => istParts(run.startedAt).dateKey === current.dateKey);
  const [inHour, inMinute] = config.schedule.punchIn.split(':').map(Number);
  const [outHour, outMinute] = config.schedule.punchOut.split(':').map(Number);
  const inDeadline = inHour! * 60 + inMinute! + config.schedule.punchInAfter;
  const outDeadline = outHour! * 60 + outMinute! + config.schedule.punchOutAfter;
  if (current.minutes > inDeadline && !todayRuns.some((run) => run.action === 'PUNCH_IN'))
    missed.push('PUNCH_IN');
  if (current.minutes > outDeadline && !todayRuns.some((run) => run.action === 'PUNCH_OUT'))
    missed.push('PUNCH_OUT');
  return missed;
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Attendance automation status</title>
<style>body{font:15px system-ui;margin:2rem;max-width:1100px;color:#17202a}header{display:flex;justify-content:space-between}pre{background:#f4f6f7;padding:1rem;overflow:auto;border-radius:8px}.bad{color:#a00}.good{color:#086}</style></head>
<body><header><h1>Attendance automation</h1><span>Local dashboard</span></header>
<p>This page never displays credentials, security answers, cookies, codes, or exact coordinates.</p>
<div id="summary">Loading…</div><pre id="data"></pre>
<script>fetch('/api/status').then(r=>r.json()).then(x=>{document.querySelector('#summary').innerHTML='<b class="'+(x.databaseHealthy?'good':'bad')+'">MongoDB '+(x.databaseHealthy?'healthy':'unavailable')+'</b> · Automation '+(x.automationEnabled&&!x.dryRun?'enabled':'safe-disabled');document.querySelector('#data').textContent=JSON.stringify(x,null,2)}).catch(e=>document.querySelector('#summary').textContent=e.message)</script>
</body></html>`;
