// @ts-ignore
import fkill from 'fkill';
import { run } from './run';
import { args } from './args';
import { logger } from './logger';
import { spawnWorkers } from './spawnWorkers';
import { addExitHandler } from './addExitHandler';

let runPromise: Promise<void>;
if (args.i) {
  runPromise = run();
} else {
  runPromise = spawnWorkers();
  addExitHandler(() => {
    // Kill any running Chromium instances
    // TODO: will this work?
    console.log('Killing Chromium instances');
    fkill(['chromium', 'chromium helper'], { ignoreCase: true });
  });
}

runPromise
  .then(() => {
    process.exit(0);
  })
  .catch((error: any) => {
    if (error) {
      logger.error('Uncaught error: ', error);
    }
    process.exit(1);
  });
