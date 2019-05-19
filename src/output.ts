import fs from 'fs-extra';
import path from 'path';
import { createArrayCsvStringifier } from 'csv-writer';
import { args } from './args';
import { LockingWriteStream } from './LockingWriteStream';
import { HEADERS } from './constants';

// Use the csv-writer library to ensure that CSV values are escaped properly
const csvStringifier = createArrayCsvStringifier({});

export const outDir = args().outDir || path.join('output', Date.now().toString());

export function ensureOutputDir() {
  fs.mkdirpSync(outDir);
}

/**
 * Create files for each year's CSV data, and write the header row to each.
 * @param years Years to create streams/files for
 */
export function createYearFiles(years: string[]) {
  ensureOutputDir();
  const headerCsv = csvStringifier.stringifyRecords([HEADERS]);
  for (const year of years) {
    // This could throw, but allow it to go uncaught since this is the beginning of the program
    // and any error here should be considered fatal.
    fs.writeFileSync(getYearFilename(year), headerCsv, { encoding: 'utf8' });
  }
}

/**
 * Create streams for writing each year's CSV data.
 * @param years Years to create streams/files for
 */
export function createYearStreams(years: string[]): { [year: string]: LockingWriteStream } {
  const yearStreams: { [year: string]: LockingWriteStream } = {};
  for (const year of years) {
    yearStreams[year] = new LockingWriteStream(getYearFilename(year));
  }
  return yearStreams;
}

/** Write a row to the CSV stream, locking the file. Returns true on success. */
export async function writeRow(stream: LockingWriteStream, row: string[]): Promise<boolean> {
  try {
    await stream.write(csvStringifier.stringifyRecords([row]));
    return true;
  } catch (ex) {
    return false;
  }
}

export function closeStreams(streams: { [key: string]: LockingWriteStream }): void {
  for (const stream of Object.values(streams)) {
    stream.end();
  }
}

function getYearFilename(year: string): string {
  return path.join(outDir, year + '.csv');
}
