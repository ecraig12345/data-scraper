import path from 'path';
import { spawn } from 'child-process-promise';
import { outDir, createYearFiles } from './output';
import { addExitHandler } from './addExitHandler';
import { years, headers } from './constants';
import { logger } from './logger';

const processCount = 4;
// const processCount = 15;

export async function spawnWorkers() {
  await createYearFiles(years, headers);

  let hasError = false;
  const promises = [...Array(processCount).keys()].map(async i => {
    const args = [path.join(process.cwd(), 'lib/main.js'), '--outDir', outDir, '--i', String(i)];
    try {
      logger.info('Spawning: node ' + args.join(' '));
      const spawnPromise = spawn('node', args, { stdio: 'inherit', detached: true });
      addExitHandler(() => {
        console.log('Killing child processes for worker ' + i);
        // Kill this process and any children when the parent exits
        // https://azimi.me/2014/12/31/kill-child_process-node-js.html
        process.kill(-spawnPromise.childProcess.pid);
      });
      await spawnPromise;
      logger.info(`Worker ${i} finished`);
    } catch (ex) {
      logger.warn(`Caught error from worker ${i}: ${ex.message || ex}`);
    }
  });

  return Promise.all(promises).then(() => {
    logger.info('All workers done');
    if (hasError) {
      return Promise.reject<void>();
    }
  });
}
