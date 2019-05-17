import fs from 'fs';
import lockfile from 'proper-lockfile';
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

  public async write(chunk: any): Promise<void> {
    await lockfile
      .lock(this._path)
      .then(release => {
        return new Promise(resolve => {
          try {
            this._stream.write(chunk, (error: Error | null | undefined) => {
              error && this._logError(error, chunk);
              resolve(release());
            });
          } catch (ex) {
            this._logError(ex, chunk);
            resolve(release());
          }
        });
      })
      .catch(err => {
        logger.error(`Error acquiring lock for ${this._path} `, err);
      });
  }

  public end() {
    this._stream.end();
  }

  private _logError(error: Error, chunk: any) {
    logger.error(`Error writing to ${this._path}`);
    // for some reason the error only seems to get logged as expected if used as second param
    if (error) {
      logger.error('', error);
    }
    logger.error(`  Was writing data: ${chunk}`);
  }
}
