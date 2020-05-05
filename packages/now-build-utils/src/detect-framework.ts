import { Framework, FrameworkDetectionItem } from '@vercel/frameworks';
import { DetectorFilesystem } from './detectors/filesystem';

export interface DetectFrameworkOptions {
  fs: DetectorFilesystem;
  frameworkList: Framework[];
}

async function matches(fs: DetectorFilesystem, framework: Framework) {
  const { detectors } = framework;

  if (!detectors) {
    return false;
  }

  const { every, some } = detectors;

  if (every !== undefined && !Array.isArray(every)) {
    return false;
  }

  if (some !== undefined && !Array.isArray(some)) {
    return false;
  }

  const check = async ({ path, matchContent }: FrameworkDetectionItem) => {
    if (!path) {
      return false;
    }

    if ((await fs.hasPath(path)) === false) {
      return false;
    }

    if (matchContent) {
      if ((await fs.isFile(path)) === false) {
        return false;
      }

      const regex = new RegExp(matchContent, 'gm');
      const content = await fs.readFile(path);

      if (!regex.test(content.toString())) {
        return false;
      }
    }

    return true;
  };

  const result: boolean[] = [];

  if (every) {
    const everyResult = await Promise.all(every.map(item => check(item)));
    result.push(...everyResult);
  }

  if (some) {
    let someResult = false;

    for (const item of some) {
      if (await check(item)) {
        someResult = true;
        break;
      }
    }

    result.push(someResult);
  }

  return result.every(res => res === true);
}

export async function detectFramework({
  fs,
  frameworkList,
}: DetectFrameworkOptions): Promise<string | null> {
  for (const framework of frameworkList) {
    if (await matches(fs, framework)) {
      return framework.slug;
    }
  }

  return null;
}
