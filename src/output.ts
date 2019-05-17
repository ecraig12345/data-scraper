import fs from 'fs-extra';
import path from 'path';
import { createArrayCsvStringifier } from 'csv-writer';
import lockfile from 'proper-lockfile';
import { logger } from './logger';
import { args } from './args';

// Use the csv-writer library to ensure that CSV values are escaped properly
const csvStringifier = createArrayCsvStringifier({});

export const outDir = args.outDir || path.join('output', Date.now().toString());

export function ensureOutputDir() {
  fs.mkdirpSync(outDir);
}

function getYearFilename(year: string): string {
  return path.join(outDir, year + '.csv');
}

/**
 * Create files for each year's CSV data, and write the header row to each.
 * @param years Years to create streams/files for
 * @param headers Headers to write to each file
 */
export function createYearFiles(years: string[], headers: string[]) {
  ensureOutputDir();
  const headerCsv = csvStringifier.stringifyRecords([headers]);
  for (const year of years) {
    fs.writeFileSync(getYearFilename(year), headerCsv, { encoding: 'utf8' });
  }
}

/**
 * Create streams for writing each year's CSV data.
 * @param years Years to create streams/files for
 */
export function createYearStreams(years: string[]): { [year: string]: fs.WriteStream } {
  const yearStreams: { [year: string]: fs.WriteStream } = {};
  for (const year of years) {
    yearStreams[year] = fs.createWriteStream(getYearFilename(year), {
      encoding: 'utf8',
      flags: 'a+' // append data
    });
  }
  return yearStreams;
}

/** Write a row to the CSV stream, locking the file */
export async function writeRow(stream: fs.WriteStream, row: string[]) {
  const data = csvStringifier.stringifyRecords([row]);

  // Since multiple processes could be trying to write to the file, we have to lock it
  await lockfile
    .lock(stream.path.toString())
    .then(release => {
      return new Promise(resolve => {
        try {
          stream.write(data, (error: Error | null | undefined) => {
            error && logError(stream, error, data);
            resolve(release());
          });
        } catch (ex) {
          logError(stream, ex, data);
          resolve(release());
        }
      });
    })
    .catch(err => {
      logger.error(`Error acquiring lock for ${stream.path.toString()} `, err);
    });
}

function logError(stream: fs.WriteStream, error: Error, data: string): void {
  logger.error(`Error writing to ${stream.path.toString()}`);
  // for some reason the error only seems to get logged as expected if used as second param
  if (error) {
    logger.error('', error);
  }
  logger.error(`  Was writing data: ${data}`);
}

export function closeStreams(streams: { [key: string]: fs.WriteStream }): void {
  for (const stream of Object.values(streams)) {
    stream.end();
  }
}
