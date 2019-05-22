import puppeteer from 'puppeteer';

export interface IRecord {
  ACCOUNTNO: string;
  /** the Account Type element of the legal tables for Base and the prior year pages */
  AccountTyp: string;
  /** Land Value */
  TotalLandV: string;
  /** Taxable Value */
  TotalValue: string;
  /** taxable - land (TotalValue - TotalLandV) */
  TotalBuild: string;
  /** Gross Assessed Value */
  TotalAsses: string;
}

export const HEADERS: (keyof IRecord)[] = [
  'ACCOUNTNO',
  'AccountTyp',
  'TotalLandV',
  'TotalValue',
  'TotalBuild',
  'TotalAsses'
];

/** CSS selectors for getting the data for each cell */
export const SELECTORS: { [K in keyof IRecord]?: string } = {
  // *= in a CSS attribute selector means check if the attribute contains the given value
  AccountTyp: '[id*="AccountTypeLabel"]',
  TotalLandV: '[id*="LandValueLabel"]',
  TotalValue: '[id*="TaxableValueLabel"]',
  TotalAsses: '[id*="GrossAssessedValueLabel"]'
};

export const ASSESSOR_URL = 'http://www.clevelandcountyassessor.us/Data.aspx?Account=';

/** Tabs/links at the top of each account page */
// prettier-ignore
export const TAB_LIST = [
  'Base', 'Land', 'Valuation', 'Tax', 'Sales', 'Sketch', 'Improvements', '2018', '2017', '2016',
  '2015', '2014', '2013', '2012', '2011', '2010', '2009', '2008', '2007', '2006', '2005', '2004'
];
/** All the years we have data for */
export const YEARS = TAB_LIST.slice(TAB_LIST.indexOf('2015'));
// export const YEARS = TAB_LIST.slice(TAB_LIST.indexOf('2018'));

/** Short account list for testing */
export const TEST_ACCOUNTS = [
  'R0153887',
  'R0022194',
  'R0090848',
  'R0033450',
  'R0033596',
  'R0033792',
  'R0095456',
  'R0032229',
  'R0068166',
  'R0166185'
];

export const NAV_OPTIONS: puppeteer.NavigationOptions = {
  // We can get data off the page as soon as initial rendering is finished (no need to wait for
  // all images/other resources to be loaded). Note that this would not work on a more modern page
  // where rendering is done in the browser using JS.
  // https://github.com/GoogleChrome/puppeteer/blob/v1.15.0/docs/api.md#pagewaitfornavigationoptions
  waitUntil: 'domcontentloaded'
};

export const RETRIES = 4;
export const TIMEOUT = 15000;
