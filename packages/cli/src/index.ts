import { cac } from 'cac';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createJiti } from 'jiti';
import { build, type MarkbookConfig } from '@markbook/core';

const CONFIG_NAMES = [
  'markbook.config.ts',
  'markbook.config.mts',
  'markbook.config.js',
  'markbook.config.mjs',
];

async function loadConfig(
  root: string,
  explicit?: string,
): Promise<MarkbookConfig> {
  const candidates = explicit
    ? [path.resolve(root, explicit)]
    : CONFIG_NAMES.map((f) => path.resolve(root, f));

  const jiti = createJiti(import.meta.url);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
    } catch {
      continue;
    }
    const mod = (await jiti.import(candidate, {
      default: true,
    })) as MarkbookConfig;
    return mod;
  }

  throw new Error(`No markbook.config.{ts,mts,js,mjs} found under ${root}`);
}

const cli = cac('markbook');

cli
  .command('build', 'Build the static documentation site')
  .option('-c, --config <path>', 'Path to markbook.config.{ts,mts,js,mjs}')
  .option('--root <path>', 'Project root (defaults to cwd)')
  .action(async (opts: { root?: string; config?: string }) => {
    try {
      const root = path.resolve(opts.root ?? process.cwd());
      const config = await loadConfig(root, opts.config);
      await build({ ...config, root: config.root ?? root });
      console.log('✓ Markbook build complete');
    } catch (err) {
      console.error('✗ Markbook build failed:');
      console.error(err);
      process.exit(1);
    }
  });

cli.help();
cli.version('0.0.0');
cli.parse();
