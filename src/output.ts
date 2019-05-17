import fs from 'fs-extra';
import path from 'path';
import { createArrayCsvStringifier } from 'csv-writer';
import { args } from './args';
import { LockingWriteStream } from './LockingWriteStream';

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

/** Write a row to the CSV stream, locking the file */
export async function writeRow(stream: LockingWriteStream, row: string[]) {
  await stream.write(csvStringifier.stringifyRecords([row]));
}

export function closeStreams(streams: { [key: string]: LockingWriteStream }): void {
  for (const stream of Object.values(streams)) {
    stream.end();
  }
}
