import fs from 'fs-extra';
import path from 'path';
import puppeteer from 'puppeteer';
import { args } from './args';
import { clickAndWait } from './clickAndWait';
import { YEARS, ASSESSOR_URL, TAB_LIST, SELECTORS, NAV_OPTIONS } from './constants';
import { getRecord } from './getRecord';
import { LockingWriteStream } from './LockingWriteStream';
import { logger } from './logger';
import { createYearStreams, writeRow, closeStreams } from './output';

export async function run() {
  // Real account list
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
  page.setDefaultNavigationTimeout(10000);

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
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(url, NAV_OPTIONS);
      return true;
    } catch (ex) {
      await page.reload(NAV_OPTIONS);
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
    logger.warn(`Account ${account}: Couldn't load page for ${year}`);
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
          logger.warn(`Account ${account} (${year}): error writing data`);
        }
      }
    }
    // If there's no data, skip this year
  } catch (ex) {}
}
