import { cac } from 'cac';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createJiti } from 'jiti';
import { build, bundleEmbed, dev, preview, type MarkbookConfig } from '@markbook/core';
import { formatInstallResults, installAll, listInstalled } from './skills.js';

const CONFIG_NAMES = [
  'markbook.config.ts',
  'markbook.config.mts',
  'markbook.config.js',
  'markbook.config.mjs',
];

async function loadConfig(root: string, explicit?: string): Promise<MarkbookConfig> {
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

interface BaseCommandOpts {
  root?: string;
  config?: string;
}

/**
 * Shared command runner: resolves the project root, loads the config, and
 * applies a consistent `✗ Markbook <label> failed:` error envelope (exit 1)
 * around every command body. The body receives the merged config (with
 * `root` applied) and the resolved root.
 */
async function runCommand<T extends BaseCommandOpts>(
  label: string,
  opts: T,
  fn: (config: MarkbookConfig, root: string) => Promise<void>,
): Promise<void> {
  try {
    const root = path.resolve(opts.root ?? process.cwd());
    const config = await loadConfig(root, opts.config);
    await fn({ ...config, root: config.root ?? root }, root);
  } catch (err) {
    console.error(`✗ Markbook ${label} failed:`);
    console.error(err);
    process.exit(1);
  }
}

/** Apply `--port` / `--host` overrides onto a config's `dev` block. */
function withDevOverrides(
  config: MarkbookConfig,
  opts: { port?: string; host?: string },
): MarkbookConfig {
  const port = opts.port ? parseInt(opts.port, 10) : undefined;
  return {
    ...config,
    dev: {
      ...config.dev,
      ...(port !== undefined ? { port } : {}),
      ...(opts.host !== undefined ? { host: opts.host } : {}),
    },
  };
}

cli
  .command('build', 'Build the static documentation site')
  .option('-c, --config <path>', 'Path to markbook.config.{ts,mts,js,mjs}')
  .option('--root <path>', 'Project root (defaults to cwd)')
  .action(async (opts: BaseCommandOpts) => {
    await runCommand('build', opts, async (config) => {
      await build(config);
      console.log('✓ Markbook build complete');
    });
  });

cli
  .command('dev', 'Start a dev server with HMR')
  .option('-c, --config <path>', 'Path to markbook.config.{ts,mts,js,mjs}')
  .option('--root <path>', 'Project root (defaults to cwd)')
  .option('--port <port>', 'Port to listen on (default: 5173)')
  .option('--host <host>', 'Host to bind to')
  .action(async (opts: BaseCommandOpts & { port?: string; host?: string }) => {
    await runCommand('dev', opts, async (config) => {
      await dev(withDevOverrides(config, opts));
    });
  });

cli
  .command(
    'preview',
    'Serve the built dist/ over HTTP (use after `markbook build` to verify the production output)',
  )
  .option('-c, --config <path>', 'Path to markbook.config.{ts,mts,js,mjs}')
  .option('--root <path>', 'Project root (defaults to cwd)')
  .option('--port <port>', 'Port to listen on (default: 4173)')
  .option('--host <host>', 'Host to bind to')
  .action(async (opts: BaseCommandOpts & { port?: string; host?: string }) => {
    await runCommand('preview', opts, async (config) => {
      await preview(withDevOverrides(config, opts));
    });
  });

cli
  .command('bundle [storyId]', 'Bundle one (or every) story as a portable artefact')
  .option('-c, --config <path>', 'Path to markbook.config.{ts,mts,js,mjs}')
  .option('--root <path>', 'Project root (defaults to cwd)')
  .option('--mode <mode>', 'embed (self-mounting ESM, default) | package (publishable npm)')
  .option('--isolation <mode>', 'Wrap each mount in an open shadow root (mode: shadow)')
  .action(
    async (
      storyId: string | undefined,
      opts: BaseCommandOpts & { mode?: string; isolation?: string },
    ) => {
      await runCommand('bundle', opts, async (config) => {
        const mode = opts.mode === 'package' ? 'package' : 'embed';
        const isolation = opts.isolation === 'shadow' ? 'shadow' : undefined;
        await bundleEmbed(config, {
          ...(storyId ? { storyId } : {}),
          mode,
          ...(isolation ? { isolation } : {}),
        });
      });
    },
  );

cli
  .command(
    'skills <action>',
    'Manage Markbook agent skills: `install` distributes skills to .claude/.codex/.opencode/.agents; `list` shows shipped + installed',
  )
  .option('--root <path>', 'Project root (defaults to cwd)')
  .option('--surface <name>', 'Limit to a single surface: .claude | .codex | .opencode | .agents')
  .option(
    '--symlink',
    'Symlink instead of copy (faster updates; not recommended on Windows or pnpm)',
  )
  .option('--update', 'Refresh installed skills whose content drifted from the shipped version')
  .option('--force', 'Overwrite skill directories even when unmanaged (no .markbook-skill.json)')
  .action(
    async (
      action: string,
      opts: {
        root?: string;
        surface?: string;
        symlink?: boolean;
        update?: boolean;
        force?: boolean;
      },
    ) => {
      const cwd = path.resolve(opts.root ?? process.cwd());
      try {
        if (action === 'install') {
          const surface = opts.surface as
            | '.claude'
            | '.codex'
            | '.opencode'
            | '.agents'
            | undefined;
          const results = await installAll({
            cwd,
            surface,
            symlink: !!opts.symlink,
            update: !!opts.update,
            force: !!opts.force,
          });
          const total = results.reduce((sum, r) => sum + r.skills.length, 0);
          const installed = results.reduce(
            (sum, r) =>
              sum +
              r.skills.filter((s) => s.action === 'installed' || s.action === 'updated').length,
            0,
          );
          console.log(formatInstallResults(results));
          console.log('');
          console.log(
            `✓ ${installed} of ${total} skill operations applied across ${results.length} ${
              results.length === 1 ? 'surface' : 'surfaces'
            }.`,
          );
        } else if (action === 'list') {
          const summary = await listInstalled(cwd);
          console.log(`Shipped (${summary.shipped.length}):`);
          for (const name of summary.shipped) console.log(`  - markbook-${name}`);
          console.log('');
          if (summary.perSurface.length === 0) {
            console.log(
              'No vendor surfaces detected (.claude, .codex, .opencode, .agents).\n' +
                'Run `markbook skills install` to set one up.',
            );
            return;
          }
          for (const s of summary.perSurface) {
            const installedCount = s.installed.length;
            const oodCount = s.outOfDate.length;
            const oodNote =
              oodCount > 0 ? ` (${oodCount} out of date — run \`skills install --update\`)` : '';
            console.log(`${s.surface}/skills/: ${installedCount} installed${oodNote}`);
            for (const name of s.installed) {
              const oodTag = s.outOfDate.includes(name) ? ' !out-of-date' : '';
              console.log(`  - markbook-${name}${oodTag}`);
            }
          }
        } else {
          console.error(`✗ Unknown skills action: '${action}'. Expected 'install' or 'list'.`);
          process.exit(1);
        }
      } catch (err) {
        console.error(`✗ Markbook skills ${action} failed:`);
        console.error(err);
        process.exit(1);
      }
    },
  );

cli.help();
cli.version('0.0.0');
cli.parse();
