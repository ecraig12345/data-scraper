import { run } from './run';
import { args } from './args';
import { logger } from './logger';
import { spawnWorkers } from './spawnWorkers';

async function main(): Promise<any> {
  if (args().i) {
    // This is a worker thread--run data collection
    try {
      await run();
    } catch (ex) {
      if (ex.message.includes('Session closed')) {
        logger.warn(ex.message);
      } else {
        logger.warn(`Unhandled error running worker ${args().i}: `, ex);
      }
    }
  } else {
    // This is the main thread--spawn the workers
    try {
      await spawnWorkers();
    } catch (ex) {
      logger.error('Uncaught error in main thread');
      logger.error('', ex);
    }
  }
}

main()
  .catch(() => undefined)
  .then(() => process.exit(0));
