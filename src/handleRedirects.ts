//
// For the first 10,000ish accounts, there were no redirects, so this is unused now.
//

import puppeteer from 'puppeteer';
import { logger } from './logger';

let _wasRedirected: boolean;

/** Will return true if the last navigation request was redirected */
export function wasRedirected(): boolean {
  return _wasRedirected;
}

/**
 * If a navigation request redirects, abort it and set `wasRedirected`.
 */
export async function handleRedirects(page: puppeteer.Page): Promise<void> {
  // https://github.com/GoogleChrome/puppeteer/issues/1132
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.isNavigationRequest()) {
      _wasRedirected = false;

      const redirects = request.redirectChain();
      if (redirects.length) {
        request.abort();
        // Log the list of redirect URLs, including the final URL (which isn't in redirectChain())
        logger.warn('Redirected: ' + [...redirects, request].map(req => req.url()).join(' => '));
        _wasRedirected = true;
      } else {
        request.continue();
      }
    } else {
      request.continue();
    }
  });
}

// function isOnRightPage(page: puppeteer.Page, account: string, year?: string): boolean {
//   const accountAndYear = year ? `Account ${account} (${year})` : account;
//   if (page.url() !== assessorURL + account) {
//     logger.error(`${accountAndYear}: skipping due to landing on wrong page, ${page.url()}`);
//     return false;
//   } else if (wasRedirected()) {
//     logger.error(
//       `${accountAndYear}: skipping because navigation to its page caused an attempted redirect`
//     );
//     return false;
//   }
//   return true;
// }
