import yargs from 'yargs';

export interface IArgs extends yargs.Arguments {
  /** Output directory name */
  outDir?: string;
  /** For sub-processes, index of file to process. Empty string for parent. */
  i: string;
}

export const args: IArgs = yargs.option('i', { string: true, default: '' }).argv;
