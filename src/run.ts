import fs from 'fs-extra';
import path from 'path';
import puppeteer from 'puppeteer';
import { args } from './args';
import { clickAndWait } from './clickAndWait';
import {
  YEARS,
  ASSESSOR_URL,
  TAB_LIST,
  SELECTORS,
  NAV_OPTIONS,
  TIMEOUT,
  RETRIES
} from './constants';
import { getRecord } from './getRecord';
import { LockingWriteStream } from './LockingWriteStream';
import { logger } from './logger';
import { createYearStreams, writeRow, closeStreams } from './output';

export async function run() {
  const rawAccounts = fs
    .readFileSync(path.join(process.cwd(), `data/normanAccounts${args().i}.csv`))
    .toString();
  const accounts = rawAccounts.trim().split(/\r?\n/);

  // Make a write stream for each year's CSV file.
  // A write stream incrementally writes data to a file. We use write streams so there will still
  // be some data even if the program crashes, and to keep the program from running out of memory.
  const yearStreams = createYearStreams(YEARS);

  // Connect to the already-running browser
  const browser = await puppeteer.connect({ browserWSEndpoint: args().wsEndpoint });

  // Make a new page, set the load timeout, and set up redirect handling
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(TIMEOUT);

  for (const account of accounts) {
    logger.info('Processing account ' + account);

    // Navigate to the account page
    const navResult = await goWithRetries(page, ASSESSOR_URL + account);
    if (!navResult) {
      logger.error(`Couldn't load page for account ${account}`);
      continue;
    }

    // For each year, navigate to its page and make a record
    for (const year of YEARS) {
      await processYear(page, account, year, yearStreams[year]);
    }
  }

  page.close();
  browser.disconnect();
  closeStreams(yearStreams);
}

async function goWithRetries(page: puppeteer.Page, url: string): Promise<boolean> {
  for (let i = 0; i < RETRIES; i++) {
    if (i > 0) {
      // If this is a retry, reload the page first
      logger.warn('Reloading page for retry #' + i);
      try {
        await page.reload(NAV_OPTIONS);
      } catch (ex) {
        logger.warn('Error reloading page: ' + ex.message);
        continue;
      }
    }

    try {
      await page.goto(url, NAV_OPTIONS);
      return true;
    } catch (ex) {
      // ignore for now
    }
  }
  return false;
}

async function processYear(
  page: puppeteer.Page,
  account: string,
  year: string,
  stream: LockingWriteStream
) {
  // Click the tab for the year and verify that it loads
  logger.verbose('  Processing year ' + year);
  const index = TAB_LIST.indexOf(year);
  const clickResult = await clickAndWait(`#ContentPlaceHolder1_mnuDatan${index} a`, page);
  if (!clickResult) {
    logger.error(`Account ${account}: Couldn't load page for ${year}`);
    return;
  }

  try {
    // Wait for either the account type or the no data indicator to show up
    const hasData = await Promise.race([
      page.waitForSelector('.nodataformview').then(() => false),
      page.waitForSelector(SELECTORS.AccountTyp!).then(() => true)
    ]);

    if (hasData) {
      // Pull data from the page to make the record and write it to the file.
      // (The record might be null if this account/year should be excluded.)
      const record = await getRecord(page, account, year);
      if (record) {
        if (!(await writeRow(stream, record))) {
          logger.error(`Account ${account} (${year}): error writing data`);
        }
      }
    }
    // If there's no data, skip this year
  } catch (ex) {}
}
