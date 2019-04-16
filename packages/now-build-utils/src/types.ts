import FileFsRef from './file-fs-ref';

export interface File {
  type: string;
  mode: number;
  toStream: () => NodeJS.ReadableStream;
}

export interface Files {
  [filePath: string]: File
}

export interface Config {
  [key: string]: string
}

export interface AnalyzeOptions {
  /**
   * All source files of the project
   */
  files: Files;

  /**
   * Name of entrypoint file for this particular build job. Value
   * `files[entrypoint]` is guaranteed to exist and be a valid File reference.
   * `entrypoint` is always a discrete file and never a glob, since globs are
   * expanded into separate builds at deployment time.
   */
  entrypoint: string;

  /**
   * A writable temporary directory where you are encouraged to perform your
   * build process. This directory will be populated with the restored cache.
   */
  workPath: string;

  /**
   * An arbitrary object passed by the user in the build definition defined
   * in `now.json`.
   */
  config: Config;
}


export interface BuildOptions {
  /**
   * All source files of the project
   */
  files: Files;

  /**
   * Name of entrypoint file for this particular build job. Value
   * `files[entrypoint]` is guaranteed to exist and be a valid File reference.
   * `entrypoint` is always a discrete file and never a glob, since globs are
   * expanded into separate builds at deployment time.
   */
  entrypoint: string;

  /**
   * A writable temporary directory where you are encouraged to perform your
   * build process. This directory will be populated with the restored cache.
   */
  workPath: string;

  /**
   * An arbitrary object passed by the user in the build definition defined
   * in `now.json`.
   */
  config: Config;
}

export interface PrepareCacheOptions {
  /**
   * All source files of the project
   */
  files: Files;

  /**
   * Name of entrypoint file for this particular build job. Value
   * `files[entrypoint]` is guaranteed to exist and be a valid File reference.
   * `entrypoint` is always a discrete file and never a glob, since globs are
   * expanded into separate builds at deployment time.
   */
  entrypoint: string;

  /**
   * A writable temporary directory where you are encouraged to perform your
   * build process.
   */
  workPath: string;

  /**
   * A writable temporary directory where you can build a cache to use for
   * the next run.
   */
  cachePath: string;

  /**
   * An arbitrary object passed by the user in the build definition defined
   * in `now.json`.
   */
  config: Config;
}

export interface ShouldServeOptions {
  /**
   * A path string from a request.
   */
  requestPath: string;
  /**
   * Name of entrypoint file for this particular build job. Value
   * `files[entrypoint]` is guaranteed to exist and be a valid File reference.
   * `entrypoint` is always a discrete file and never a glob, since globs are
   * expanded into separate builds at deployment time.
   */
  entrypoint: string;
  /**
   * All source files of the project
   */
  files: {
    [path: string]: FileFsRef
  };
  /**
   * An arbitrary object passed by the user in the build definition defined
   * in `now.json`.
   */
  config: Config;
}
