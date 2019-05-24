import yargs from 'yargs';

export interface IArgs {
  // /** For sub-processes, output directory name */
  // outDir: string;
  /** For sub-processes, index of file to process. Empty string for parent. */
  i: string;
  /** For sub-processes, web socket endpoint for an already-running Chromium instance */
  wsEndpoint: string;
}

let _args: IArgs = yargs.options({
  i: { string: true, default: '' },
  // outDir: { string: true, default: '' },
  wsEndpoint: { string: true, default: '' }
}).argv;

export function args(): IArgs {
  return _args;
}

export function overrideArgs(newArgs: IArgs): void {
  _args = newArgs;
}
