import path from 'path';
import FileFsRef from '../file-fs-ref';
import { File, Files, Meta } from '../types';
import { remove, mkdirp, readlink, symlink } from 'fs-extra';

export interface DownloadedFiles {
  [filePath: string]: FileFsRef;
}

const S_IFMT = 61440; /* 0170000 type of file */
const S_IFLNK = 40960; /* 0120000 symbolic link */

export function isSymbolicLink(mode: number): boolean {
  return (mode & S_IFMT) === S_IFLNK;
}

async function downloadFile(file: File, fsPath: string): Promise<FileFsRef> {
  const { mode } = file;
  if (mode && isSymbolicLink(mode) && file.type === 'FileFsRef') {
    const [target] = await Promise.all([
      readlink((file as FileFsRef).fsPath),
      mkdirp(path.dirname(fsPath)),
    ]);
    await symlink(target, fsPath);
    return FileFsRef.fromFsPath({ mode, fsPath });
  } else {
    const stream = file.toStream();
    return FileFsRef.fromStream({ mode, stream, fsPath });
  }
}

async function removeFile(basePath: string, fileMatched: string) {
  const file = path.join(basePath, fileMatched);
  await remove(file);
}

export default async function download(
  files: Files,
  basePath: string,
  meta?: Meta
): Promise<DownloadedFiles> {
  const { isDev = false, filesChanged = null, filesRemoved = null } =
    meta || {};

  if (isDev) {
    // In `now dev`, the `download()` function is a no-op because
    // the `basePath` matches the `cwd` of the dev server, so the
    // source files are already available.
    return files as DownloadedFiles;
  }

  const files2: DownloadedFiles = {};

  await Promise.all(
    Object.keys(files).map(async name => {
      // If the file does not exist anymore, remove it.
      if (Array.isArray(filesRemoved) && filesRemoved.includes(name)) {
        await removeFile(basePath, name);
        return;
      }

      // If a file didn't change, do not re-download it.
      if (Array.isArray(filesChanged) && !filesChanged.includes(name)) {
        return;
      }

      const file = files[name];
      const fsPath = path.join(basePath, name);

      files2[name] = await downloadFile(file, fsPath);
    })
  );

  return files2;
}
