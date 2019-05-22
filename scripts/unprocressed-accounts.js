// @ts-check

// Find which accounts have been processed, and split the ones that haven't into new input files.
// (Old input files must have already been moved to a different location.)

const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const CHUNKS = 8;

const resultDirs = [
  path.join(process.cwd(), 'output', 'try2a'),
  path.join(process.cwd(), 'output', 'try2b')
];
const dataDir = path.join(process.cwd(), 'data');

const allAccounts = fs
  .readFileSync(path.join(dataDir, 'orig_normanAccounts.csv'))
  .toString()
  .split(/\r?\n/g);

const processedAccounts = new Set();

for (const resultDir of resultDirs) {
  const files = fs.readdirSync(resultDir);
  for (const file of files) {
    if (!file.endsWith('.csv')) {
      continue;
    }

    const lines = fs
      .readFileSync(path.join(resultDir, file))
      .toString()
      .split(/\r?\n/g);
    lines.shift(); // remove header
    for (const line of lines) {
      const accountMatch = line.match(/^[^,]*/);
      if (accountMatch) {
        processedAccounts.add(accountMatch[0]);
      }
    }
  }
}

const unprocessedAccounts = allAccounts.filter(a => !processedAccounts.has(a));

const chunkSize = Math.ceil(unprocessedAccounts.length / CHUNKS);
for (let i = 0; i < CHUNKS; i++) {
  const chunk = unprocessedAccounts.splice(0, chunkSize);
  fs.writeFileSync(path.join(dataDir, `normanAccounts${i}.csv`), chunk.join(os.EOL) + os.EOL);
}
