// @ts-check
const fs = require('fs-extra');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
const outputRoot = path.join(process.cwd(), 'output');
const resultDirs = ['complete'];

const allAccounts = fs
  .readFileSync(path.join(dataDir, 'orig_normanAccounts.csv'))
  .toString()
  .split(/\r?\n/g);

const processedAccounts = new Set();
const exemptReal = new Set();

// /** @type {{[year: string]: Set<string>}} */
// const accountsByYear = {};
/** @type {{[account: string]: string[]}} */
const accountYears = {};
/** @type {{[account: string]: string[]}} */
const missingData = {};
/** @type {string[]} */
const incompleteAccounts = [];

for (const resultDir of resultDirs) {
  const fullResultDir = path.join(outputRoot, resultDir);
  const files = fs.readdirSync(fullResultDir);
  for (const file of files) {
    if (!file.endsWith('.log') && !file.endsWith('.csv')) {
      continue;
    }

    const lines = fs
      .readFileSync(path.join(fullResultDir, file))
      .toString()
      .split(/\r?\n/g);
    // remove ending blank line
    lines.pop();
    if (file.endsWith('.csv')) {
      // remove headers
      lines.shift();

      const year = file.replace('.csv', '');

      for (const line of lines) {
        const accountMatch = line.match(/^[^,]*/);
        if (accountMatch) {
          const account = accountMatch[0];
          if (!accountYears[account]) {
            accountYears[account] = [];
          }
          accountYears[account].push(year);
        }
      }
    } else if (file === 'errors.log') {
    } else if (file === 'info.log') {
      for (let line of lines) {
        let match = line.match(/Account (\w+): Couldn't load page for (\d+)/);
        if (match) {
          const [, account, year] = match;
          if (!missingData[account]) {
            missingData[account] = [];
          }
          missingData[account].push(year);
        } else if (
          (match = line.match(/Account (\w+) \(\d+\): skipping account of type "EXEMPT REAL"/))
        ) {
          processedAccounts.add(match[1]);
          exemptReal.add(match[1]);
        }
      }
    }
  }
}
