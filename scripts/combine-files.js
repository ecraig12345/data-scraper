// @ts-check
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const outputRoot = path.join(process.cwd(), 'output');
const resultDirs = ['try2a', 'try2b', 'try2c', 'try2d', 'try2e', 'try2f'];

// prettier-ignore
const files = [
  '2015.csv', '2014.csv', '2013.csv', '2012.csv', '2011.csv', '2010.csv', '2009.csv', '2008.csv',
  '2007.csv', '2006.csv', '2005.csv', '2004.csv', 'errors.log', 'info.log'
];

// Create a stream for each combined file
/** @type {{[filename: string]: fs.WriteStream}} */
const outStreams = {};
for (const file of files) {
  const hasFile = fs.existsSync(path.join(outputRoot, file));
  outStreams[file] = fs.createWriteStream(path.join(outputRoot, file), { flags: 'a+' });
  if (file.endsWith('.csv')) {
    // accountsByYear[file.replace('.csv', '')] = new Set();
    if (!hasFile) {
      // If it's a CSV file which doesn't already exist, write the header
      outStreams[file].write(
        'ACCOUNTNO,AccountTyp,TotalLandV,TotalValue,TotalBuild,TotalAsses' + os.EOL
      );
    }
  }
}

for (const resultDir of resultDirs) {
  const fullResultDir = path.join(outputRoot, resultDir);
  const files = fs.readdirSync(fullResultDir);
  for (const file of files) {
    if (!outStreams[file]) {
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
      for (let line of lines) {
        // On some lines, TotalBuild accidentally ended up negative. Replace that with 0.
        outStreams[file].write(line.replace(/^((?:[^,]+,){4})-([\d.]+)/, '$10.00') + os.EOL);
      }
    } else if (file === 'errors.log') {
      for (let line of lines) {
        if (
          !line.includes('Timeout or other error attempting to find and click link') &&
          !line.includes('Reloading page for retry #') &&
          !line.includes('Error reloading page: Navigation Timeout Exceeded')
        ) {
          if (line.includes("Couldn't load page for")) {
            line = line.replace('[warn]', '[error]');
          }
          outStreams[file].write(line + os.EOL);
        }
      }
    } else if (file === 'info.log') {
      for (let line of lines) {
        if (line.includes("Couldn't load page for")) {
          line = line.replace('[warn]', '[error]');
        }
        outStreams[file].write(line + os.EOL);
      }
    }
  }
}

for (const stream of Object.values(outStreams)) {
  stream.close();
}
