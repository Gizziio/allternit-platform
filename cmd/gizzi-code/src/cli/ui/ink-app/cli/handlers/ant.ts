import { Command as CommanderCommand } from '@commander-js/extra-typings';
import { cwd } from 'process';

export async function upHandler(): Promise<void> {
  const { up } = await import('../../../../cli/up.js');
  await up();
}

export async function rollbackHandler(target?: string, options?: {
  list?: boolean;
  dryRun?: boolean;
  safe?: boolean;
}): Promise<void> {
  const { rollback } = await import('../../../../cli/rollback.js');
  await rollback(target, options);
}

export async function logHandler(logId: string | number | undefined): Promise<void> {
  const { logHandler: actualLogHandler } = await import('../../../../cli/handlers/ant.js');
  await actualLogHandler(logId);
}

export async function errorHandler(number: number | undefined): Promise<void> {
  const { errorHandler: actualErrorHandler } = await import('../../../../cli/handlers/ant.js');
  await actualErrorHandler(number);
}

export async function exportHandler(source: string, outputFile: string): Promise<void> {
  const { exportHandler: actualExportHandler } = await import('../../../../cli/handlers/ant.js');
  await actualExportHandler(source, outputFile);
}

export async function taskCreateHandler(subject: string, opts: {
  description?: string;
  list?: string;
}): Promise<void> {
  const { taskCreateHandler: actualTaskCreateHandler } = await import('../../../../cli/handlers/ant.js');
  await actualTaskCreateHandler(subject, opts);
}

export async function taskListHandler(opts: {
  list?: string;
  pending?: boolean;
  json?: boolean;
}): Promise<void> {
  const { taskListHandler: actualTaskListHandler } = await import('../../../../cli/handlers/ant.js');
  await actualTaskListHandler(opts);
}

export async function taskGetHandler(id: string, opts: {
  list?: string;
}): Promise<void> {
  const { taskGetHandler: actualTaskGetHandler } = await import('../../../../cli/handlers/ant.js');
  await actualTaskGetHandler(id, opts);
}

export async function taskUpdateHandler(id: string, opts: {
  list?: string;
  status?: string;
  subject?: string;
  description?: string;
  owner?: string;
  clearOwner?: boolean;
}): Promise<void> {
  const { taskUpdateHandler: actualTaskUpdateHandler } = await import('../../../../cli/handlers/ant.js');
  await actualTaskUpdateHandler(id, opts);
}

export async function taskDirHandler(opts: {
  list?: string;
}): Promise<void> {
  const { taskDirHandler: actualTaskDirHandler } = await import('../../../../cli/handlers/ant.js');
  await actualTaskDirHandler(opts);
}

export async function completionHandler(shell: string, opts: {
  output?: string;
}, program: CommanderCommand<any>): Promise<void> {
  const { completionHandler: actualCompletionHandler } = await import('../../../../cli/handlers/ant.js');
  await actualCompletionHandler(shell, opts, program);
}
