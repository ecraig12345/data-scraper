import puppeteer from 'puppeteer';
import { logger } from './logger';
import { NAV_OPTIONS, RETRIES } from './constants';

/**
 * Wait for a link/button to appear on the page, click it, and wait for navigation to finish.
 * The waiting part is important because otherwise, the content you're looking for on the next
 * page might not be there yet.
 */
export async function clickAndWait(linkSelector: string, page: puppeteer.Page): Promise<boolean> {
  // Try multiple times to load the page and click the link
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
      // Get the link using the selector
      const link = await page.waitForSelector(linkSelector);
      if (link) {
        // Click the link and wait for navigation
        await Promise.all([
          // The navigation wait must start before the URL changes, or navigation won't be detected
          page.waitForNavigation(NAV_OPTIONS),
          link.click()
        ]);
        return true;
      } else {
        logger.warn('Could not find element to click');
      }
    } catch (ex) {
      logger.warn('Timeout or other error attempting to find and click link: ' + ex.message);
    }
  }

  return false;
}
