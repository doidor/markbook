import path from 'node:path';
import * as pagefind from 'pagefind';

/**
 * Run Pagefind across `outDir` to produce the static search index at
 * `<outDir>/pagefind/`. Called by `build()` against the production
 * `outDir`, and by `dev()` against `tmpDir` so the dev server's `{{ search }}`
 * slot actually finds something.
 *
 * Exported for tests / advanced consumers building their own pipeline on
 * top of `writePages`. Most consumers should just use `build()` or `dev()`.
 */
export async function runPagefind(outDir: string): Promise<void> {
  const create = await pagefind.createIndex({});
  const errs = (create as { errors?: string[] }).errors;
  if (errs && errs.length > 0) {
    throw new Error(`Pagefind createIndex: ${errs.join(', ')}`);
  }
  const index = (create as { index?: unknown }).index;
  if (!index) throw new Error('Pagefind: failed to create index');

  const idx = index as {
    addDirectory: (opts: { path: string }) => Promise<{ errors?: string[] }>;
    writeFiles: (opts: { outputPath: string }) => Promise<{ errors?: string[] }>;
  };

  const addRes = await idx.addDirectory({ path: outDir });
  if (addRes.errors && addRes.errors.length > 0) {
    throw new Error(`Pagefind addDirectory: ${addRes.errors.join(', ')}`);
  }
  const writeRes = await idx.writeFiles({
    outputPath: path.join(outDir, 'pagefind'),
  });
  if (writeRes.errors && writeRes.errors.length > 0) {
    throw new Error(`Pagefind writeFiles: ${writeRes.errors.join(', ')}`);
  }
}
