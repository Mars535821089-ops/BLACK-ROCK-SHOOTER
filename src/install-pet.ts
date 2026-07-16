import { cp, mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

type InstallOptions = {
  sourceDir: string;
  petsRoot: string;
  slug: string;
  validate: (directory: string) => Promise<void>;
  rename?: typeof rename;
};

export async function installPet(options: InstallOptions) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(options.slug)) {
    throw new Error(`Invalid pet slug: ${options.slug}`);
  }

  const target = join(options.petsRoot, options.slug);
  const staging = join(options.petsRoot, `.${options.slug}.staging`);
  const backup = join(options.petsRoot, `${options.slug}.backup-${Date.now()}`);
  const renamePath = options.rename ?? rename;

  await mkdir(options.petsRoot, { recursive: true });
  await rm(staging, { recursive: true, force: true });
  try {
    await cp(options.sourceDir, staging, { recursive: true });
    await options.validate(staging);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }

  let backupPath: string | null = null;
  try {
    await renamePath(target, backup);
    backupPath = backup;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  try {
    await renamePath(staging, target);
  } catch (error) {
    try {
      if (backupPath) await renamePath(backupPath, target);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
    throw error;
  }

  return { target, backupPath };
}
