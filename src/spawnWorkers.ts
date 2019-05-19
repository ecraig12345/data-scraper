import os from 'os';
import path from 'path';
import { spawn } from 'child-process-promise';
import delay from 'delay';
import fkill from 'fkill';
import puppeteer from 'puppeteer';
import { addExitHandler } from './addExitHandler';
import { clickAndWait } from './clickAndWait';
import { YEARS, ASSESSOR_URL, TEST_ACCOUNTS } from './constants';
import { logger } from './logger';
import { outDir, createYearFiles } from './output';

// const PROCESS_COUNT = 2;
const PROCESS_COUNT = 15;

export async function spawnWorkers() {
  // Start the file for each year
  await createYearFiles(YEARS);

  // Launch ONE browser...
  const browser = await puppeteer.launch({
    // Set headless to false to see what the browser is doing
    headless: true
    // If you depend on puppeteer-core, that allows skipping the 90MB Chromium download and using
    // existing Chrome, but the current Chrome version must be a bit out of sync with Puppeteer
    // because it hangs when trying to load pages.
    // executablePath:
    //   os.platform() === 'darwin'
    //     ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    //     : 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  });

  // Accept the disclaimer
  const page = await browser.newPage();
  await acceptDisclaimer(page);

  // Start the workers
  const promises = [...Array(PROCESS_COUNT).keys()].map(i => launchWorker(browser, i));

  // Uncomment this part to run a single instance on the main thread for debugging
  // overrideArgs({ i: '0', wsEndpoint: browser.wsEndpoint(), outDir });
  // const promises = [run()];

  addExitHandler(async () => {
    console.log('Closing browser');
    await browser.close();

    // Kill any running Chromium instances
    // TODO: will this work?
    console.log("Very insistently closing browser to be sure it's gone");
    await fkill(['chromium', 'chromium helper'], { ignoreCase: true });
  });

  return Promise.all(promises).then(() => {
    logger.info('All workers done');
  });
}

/** Try to go to the first account's page, then accept the disclaimer */
async function acceptDisclaimer(page: puppeteer.Page): Promise<void> {
  logger.info('Accepting disclaimer using account ' + TEST_ACCOUNTS[0]);
  await page.goto(ASSESSOR_URL + TEST_ACCOUNTS[0]);

  if (page.url().includes('Disclaimer.aspx')) {
    const clickResult = await clickAndWait('input[name*="btnDisclaimerAccept"]', page);
    if (page.url().includes('Disclaimer.aspx') || !clickResult) {
      throw new Error(
        'Accept button did not navigate back to regular page; still on ' + page.url()
      );
    }
    logger.info('Accepted disclaimer');
  } else {
    logger.info('Disclaimer not shown');
  }
}

async function launchWorker(browser: puppeteer.Browser, i: number) {
  // arg definitions are in args.ts
  const nodeArgs = [
    path.join(process.cwd(), 'lib/main.js'),
    '--outDir',
    outDir,
    '--i',
    String(i),
    '--wsEndpoint',
    browser.wsEndpoint()
  ];
  try {
    // Wait before starting to offset the processes a bit
    if (i > 0) {
      await delay(250);
    }

    logger.info('Spawning: node ' + nodeArgs.join(' '));
    await spawn('node', nodeArgs, {
      stdio: 'inherit',
      // On Mac, detached seems to be needed to get the output sent to the console live.
      // On Windows, it causes the program to exit immediately??
      detached: os.platform() === 'darwin'
    });
    logger.info(`Worker ${i} finished`);
  } catch (ex) {
    logger.warn(`Error spawning worker ${i}: ${ex.message || ex}`);
  }
}
