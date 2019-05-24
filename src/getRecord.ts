import puppeteer from 'puppeteer';
import { IRecord, SELECTORS, HEADERS } from './constants';
import { logger } from './logger';

/**
 * Get a row of data for the account. Returns null if the account+year should be excluded.
 */
export async function getRecord(
  page: puppeteer.Page,
  account: string,
  year: string
): Promise<string[] | null> {
  const record: IRecord = {
    ACCOUNTNO: account,
    AccountTyp: '',
    TotalLandV: '0.00',
    TotalValue: '0.00',
    TotalBuild: '0.00',
    TotalAsses: '0.00'
  };
  const prefix = `Account ${account} (${year})`;

  for (const entry of Object.entries(SELECTORS)) {
    const header = entry[0] as keyof IRecord;
    const selector = entry[1]!;
    try {
      const dataCell = await page.$(selector);
      // To get the cell's content, we have to evaluate a function in the actual browser context
      // https://github.com/GoogleChrome/puppeteer/issues/3051
      let text = dataCell && (await page.evaluate((el: HTMLElement) => el.textContent, dataCell));
      if (header === 'AccountTyp') {
        // Exclude accounts of unknown type
        if (!text || text === 'EXEMPT REAL') {
          logger.info(`${prefix}: skipping account of type "${text}"`);
          return null;
        }
      }

      if (text) {
        if (header === 'AccountTyp') {
          record.AccountTyp = text;
          if (text === 'EXEMPT REAL') {
            // This category of accounts is strange and should be excluded
            return null;
          }
        } else {
          // Get rid of $ and ,
          text = text.replace(/[$,]/g, '');
          // Verify that the number follows the standard dollars/cents format, then save it
          if (/^\d+\.\d\d$/.test(text)) {
            record[header] = text;
          } else {
            // Log unusually-formatted values and don't include them in the output
            logger.warn(`${prefix}: ${header} had unusual value "${text}"`);
          }
        }
      } else {
        logger.info(`${prefix}: ${header} data not found`);
      }
    } catch (ex) {
      logger.warn(`${prefix}: Error getting ${header} data - `, ex);
    }
  }

  // Calculate the TotalBuild value if possible
  if (record.TotalLandV && record.TotalValue) {
    // If TotalValue is 0 for some reason, don't let TotalBuild end up negative
    // prettier-ignore
    record.TotalBuild = Math.max(0, Number(record.TotalValue) - Number(record.TotalLandV)).toFixed(2);
  }

  // Make sure the returned record is in the right order
  return HEADERS.map((header: keyof IRecord) => String(record[header]));
}
