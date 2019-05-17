import fs from 'fs-extra';
import path from 'path';
import puppeteer from 'puppeteer';
import { logger } from './logger';
import { createYearStreams, writeRow, closeStreams } from './output';
import { years, headers, assessorURL, tabList, IRecord, selectors } from './constants';
import { args } from './args';
import { addExitHandler } from './addExitHandler';

/** Will be set to true if the last navigation request was redirected */
let wasRedirected = false;

export async function run() {
  try {
    await reallyRun();
  } catch (ex) {
    if (ex.message.includes('Session closed')) {
      logger.warn(ex.message);
    } else {
      logger.warn(`Unhandled error running worker ${args.i}: `, ex);
    }
  }
}

async function reallyRun() {
  // Real account list
  const rawAccounts = fs
    .readFileSync(path.join(process.cwd(), `data/normanAccounts${args.i}.csv`))
    .toString();
  const accounts = rawAccounts.trim().split(/\r?\n/);

  // Make a write stream for each year's CSV file.
  // A write stream incrementally writes data to a file. We use write streams so there will still
  // be some data even if the program crashes, and to keep the program from running out of memory.
  const yearStreams = createYearStreams(years);

  // Launch browser
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
  addExitHandler(() => {
    browser.close();
  });

  const page = await browser.newPage();

  // Accept the disclaimer
  await acceptDisclaimer(page, accounts[0]);

  // Set up redirect handling *after* the redirect to the disclaimer
  await handleRedirects(page);

  for (const account of accounts) {
    logger.info('Processing account ' + account);
    // Navigate to the account page
    if (!page.url().endsWith(account)) {
      await page.goto(assessorURL + account);
    }

    // Verify we ended up in the right place, and skip the account if not
    if (!isOnRightPage(page, account)) {
      continue;
    }

    // For each year, navigate to its page and make a record
    for (const year of years) {
      // Click the tab for the year and verify that it loads
      logger.verbose('  Processing year ' + year);
      const index = tabList.indexOf(year);
      const linkSelector = `#ContentPlaceHolder1_mnuDatan${index} a`;
      const link = await page.$(linkSelector);
      if (link) {
        // Wait for navigation and for the right year to have the selecteditem class
        const clickResult = await clickAndWait(link, page, linkSelector + '.selecteditem');
        if (!isOnRightPage(page, account, year) || !clickResult) {
          continue;
        }
        // Skip this account and year if there's no data--for example, 2011 and earlier
        // here: http://www.clevelandcountyassessor.us/Data.aspx?Account=R0162307
        const noDataElem = await page.$('.nodataformview');
        if (noDataElem) {
          continue;
        }
      } else {
        logger.error(`Account ${account}: Could not find link for ${year}. Skipping.`);
        continue;
      }

      // Pull data from the page to make the record and write it to the file
      const record = await getRecord(page, account, year);
      await writeRow(yearStreams[year], record);
    } // end years loop
  } // end accounts loop

  closeStreams(yearStreams);
}

/**
 * If a navigation request redirects, abort it and set `wasRedirected`.
 */
async function handleRedirects(page: puppeteer.Page): Promise<void> {
  // https://github.com/GoogleChrome/puppeteer/issues/1132
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.isNavigationRequest()) {
      wasRedirected = false;

      const redirects = request.redirectChain();
      if (redirects.length) {
        request.abort();
        // Log the list of redirect URLs, including the final URL (which isn't in redirectChain())
        logger.warn('Redirected: ' + [...redirects, request].map(req => req.url()).join(' => '));
        wasRedirected = true;
      } else {
        request.continue();
      }
    } else {
      request.continue();
    }
  });
}

/**
 * Click a link and wait for either navigation to finish, or a certain element to show up.
 * The waiting part is important because otherwise, the content you're looking for on the next
 * page might not be there yet. Waits for up to 5 seconds.
 */
async function clickAndWait(
  link: puppeteer.ElementHandle<Element>,
  page: puppeteer.Page,
  selector?: string
): Promise<boolean> {
  return Promise.all<any>([
    link!.click(),
    selector
      ? page.waitForSelector(selector, { timeout: 5000 })
      : page.waitForNavigation({ timeout: 5000 }) //, waitUntil: 'networkidle0' })
  ])
    .then(() => true) // return true if it succeeds
    .catch(async () => {
      // If there's a timeout or other error, return false.
      // There's no proper way to "press stop" in Puppeteer right now, so use a hack with a
      // private member as shown here: https://github.com/GoogleChrome/puppeteer/issues/3238
      await ((page as any)._client as puppeteer.CDPSession).send('Page.stopLoading');
      return false;
    });
}

/** Try to go to the first account's page, then accept the disclaimer */
async function acceptDisclaimer(page: puppeteer.Page, account: string): Promise<void> {
  logger.info('Accepting disclaimer using account ' + account);
  await page.goto(assessorURL + account);

  if (page.url().includes('Disclaimer.aspx')) {
    const accept = await page.$('input[name*="btnDisclaimerAccept"]');
    if (accept) {
      const clickResult = await clickAndWait(accept, page);
      if (page.url().includes('Disclaimer.aspx') || !clickResult) {
        console.log(page.url());
        throw new Error('Accept button did not navigate back to regular page');
      }
      logger.info('Accepted disclaimer');
    } else {
      throw new Error('Could not find accept button');
    }
  } else {
    logger.info('Disclaimer not shown');
  }
}

function isOnRightPage(page: puppeteer.Page, account: string, year?: string): boolean {
  const accountAndYear = year ? `Account ${account} (${year})` : account;
  if (page.url() !== assessorURL + account) {
    logger.error(`${accountAndYear}: skipping due to landing on wrong page, ${page.url()}`);
    return false;
  } else if (wasRedirected) {
    logger.error(
      `${accountAndYear}: skipping because navigation to its page caused an attempted redirect`
    );
    return false;
  }
  return true;
}

async function getRecord(page: puppeteer.Page, account: string, year: string): Promise<string[]> {
  const record: IRecord = {
    ACCOUNTNO: account,
    AccountTyp: '',
    TotalLandV: '',
    TotalValue: '',
    TotalBuild: '',
    TotalAsses: ''
  };

  for (const entry of Object.entries(selectors)) {
    const header = entry[0] as keyof IRecord;
    const selector = entry[1]!;

    const dataCell = await page.$(selector);
    // To get the cell's content, we have to evaluate a function in the actual browser context
    // https://github.com/GoogleChrome/puppeteer/issues/3051
    let text = dataCell && (await page.evaluate((el: HTMLElement) => el.textContent, dataCell));
    if (text) {
      if (header === 'AccountTyp') {
        // This cell isn't a number
        record.AccountTyp = text;
      } else {
        // Get rid of $ and ,
        text = text.replace(/[$,]/g, '');
        // Verify that the number follows the standard dollars/cents format, then save it
        if (/^\d+\.\d\d$/.test(text)) {
          record[header] = text;
        } else {
          // Log unusually-formatted values and don't include them in the output
          logger.warn(`Account ${account} (${year}): ${header} had unusual value "${text}"`);
        }
      }
    } else {
      logger.info(`Account ${account} (${year}): ${header} data not found`);
    }
  }

  // Calculate the TotalBuild value if possible
  if (record.TotalLandV && record.TotalValue) {
    record.TotalBuild = String(Number(record.TotalValue) - Number(record.TotalLandV));
  }

  // Make sure the returned record is in the right order
  return headers.map((header: keyof IRecord) => String(record[header]));
}
