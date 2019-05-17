import fs from 'fs';
import os from 'os';
import lockfile from 'proper-lockfile';
import { MESSAGE } from 'triple-beam';
import TransportStream from 'winston-transport';
import { logger } from './logger';

export class LockingWriteStream {
  private _path: string;
  private _stream: fs.WriteStream;

  constructor(path: string) {
    this._path = path;
    this._stream = fs.createWriteStream(path, {
      encoding: 'utf8',
      flags: 'a+' // append data
    });
  }

  public async write(
    chunk: any,
    callback?: (error: Error | null | undefined) => void
  ): Promise<void> {
    let release: (() => Promise<void>) | undefined;
    let lastError: Error | undefined;
    let start = Date.now();
    while (!release && Date.now() - start < 1000) {
      try {
        release = await lockfile.lock(this._path);
      } catch (ex) {
        lastError = ex;
      }
    }

    if (!release) {
      const errorMsg = `Could not acquire lock for ${this._path} after 1 second`;
      logger.error(errorMsg);
      logger.error('Last error: ', lastError);
      callback && callback(new Error(errorMsg));
    }

    try {
      await new Promise(resolve => {
        try {
          this._stream.write(chunk, (error: Error | null | undefined) => {
            error && this._logError(error, chunk);
            release!();
            resolve();
            callback && callback(error);
          });
        } catch (ex) {
          this._logError(ex, chunk);
          release!();
          resolve();
          callback && callback(ex);
        }
      });
    } catch (err) {
      logger.error(`Error acquiring lock for ${this._path} `, err);
      callback && callback(err);
    }
    return undefined;
  }

  public end() {
    this._stream.end();
  }

  // Access to other methods from fs.WriteStream can be added as needed

  private _logError(error: Error, chunk: any) {
    logger.error(`Error writing to ${this._path}`);
    // for some reason the error only seems to get logged as expected if used as second param
    if (error) {
      logger.error('', error);
    }
    logger.error(`  Was writing data: ${chunk}`);
  }
}

/** Custom Winston transport for locking writes to a file. */
// Based on https://github.com/winstonjs/winston/blob/master/lib/winston/transports/stream.js
export class LockingStreamTransport extends TransportStream {
  private _stream: LockingWriteStream;

  constructor(opts: TransportStream.TransportStreamOptions & { filename: string }) {
    super(opts);
    this._stream = new LockingWriteStream(opts.filename);
  }

  public log(info: any, callback?: () => void) {
    this._stream.write(`${info[MESSAGE]}${os.EOL}`, callback).catch(() => undefined);
  }
}
