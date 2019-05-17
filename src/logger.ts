import os from 'os';
import path from 'path';
import { createLogger, format, transports } from 'winston';
import { ensureOutputDir, outDir } from './output';
import { args } from './args';

ensureOutputDir();
const processNum = args.i;

// Docs: https://github.com/winstonjs/logform
const defaultFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(info => {
    // Wrap the level in [square brackets]. Fancy replace syntax is needed because the level
    // may contain color codes, and I want the braces inside the color codes.
    // For child processes, add the process number to the log too.
    const level = info.level.replace(
      /verbose|info|warn|error/,
      substr => `[${substr}]${processNum ? `[${processNum}]` : ''}`
    );
    let message = `${info.timestamp} ${level} ${info.message}`;
    if (info.stack) {
      // If there's an error, add additional log lines for the stack
      message += (info.stack as string)
        .split(/\r?\n/g)
        .map(line => `${os.EOL}${info.timestamp} ${level} ${line}`)
        .join('');
    }
    return message;
  })
);

export const logger = createLogger({
  format: defaultFormat,
  transports: [
    // One log file with just warnings/errors for readability
    new transports.File({
      filename: path.join(outDir, `errors${processNum}.log`),
      level: 'warn'
    }),
    // Another with info/warnings/errors
    new transports.File({
      filename: path.join(outDir, `info${processNum}.log`),
      level: 'info'
    }),
    // Write all log entries to the console. The idea is that once the operation finishes, we
    // probably don't need a complete play-by-play of what accounts were processed, but that level
    // of detail can be helpful in the console to verify 1) the program isn't stuck and 2) if it
    // crashes, what it was last working on.
    new transports.Console({
      level: 'verbose',
      // Use color codes in the console log messages
      format: format.combine(format.colorize(), defaultFormat)
    })
  ]
});
