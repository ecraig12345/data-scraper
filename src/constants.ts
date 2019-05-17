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

export const headers: (keyof IRecord)[] = [
  'ACCOUNTNO',
  'AccountTyp',
  'TotalLandV',
  'TotalValue',
  'TotalBuild',
  'TotalAsses'
];

/** CSS selectors for getting the data for each cell */
export const selectors: { [K in keyof IRecord]?: string } = {
  // *= in a CSS attribute selector means check if the attribute contains the given value
  AccountTyp: '[id*="AccountTypeLabel"]',
  TotalLandV: '[id*="LandValueLabel"]',
  TotalValue: '[id*="TaxableValueLabel"]',
  TotalAsses: '[id*="GrossAssessedValueLabel"]'
};

export const assessorURL = 'http://www.clevelandcountyassessor.us/Data.aspx?Account=';

/** Tabs/links at the top of each account page */
// prettier-ignore
export const tabList = [
  'Base', 'Land', 'Valuation', 'Tax', 'Sales', 'Sketch', 'Improvements', '2018', '2017', '2016',
  '2015', '2014', '2013', '2012', '2011', '2010', '2009', '2008', '2007', '2006', '2005', '2004'
];
/** All the years we have data for */
export const years = tabList.slice(tabList.indexOf('2018'));

/** Short account list for testing */
export const accounts = [
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
