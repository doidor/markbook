import path from 'node:path';
import fs from 'node:fs';
import { withCustomConfig, withDefaultConfig } from 'react-docgen-typescript';

type Parser = ReturnType<typeof withDefaultConfig>;
const parserCache = new Map<string, Parser>();

export async function extractComponentProps(
  absComponentFile: string,
  exportName?: string,
  projectRoot?: string,
): Promise<{ tableHtml: string; tableMarkdown: string } | null> {
  const startDir = projectRoot ?? path.dirname(absComponentFile);
  const tsConfigPath = findTsConfig(startDir);
  const cacheKey = tsConfigPath ?? '__default__';

  let parser = parserCache.get(cacheKey);
  if (!parser) {
    const opts = {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop: { parent?: { fileName: string } }) =>
        !prop.parent?.fileName.includes('node_modules'),
    };
    parser = tsConfigPath ? withCustomConfig(tsConfigPath, opts) : withDefaultConfig(opts);
    parserCache.set(cacheKey, parser);
  }

  let components: ReturnType<Parser['parse']>;
  try {
    components = parser.parse(absComponentFile);
  } catch {
    return null;
  }
  if (!components || components.length === 0) return null;

  const target = exportName ? components.find((c) => c.displayName === exportName) : components[0];
  if (!target) return null;

  const props = Object.values(target.props);
  if (props.length === 0) return null;

  const mdHeader = `| Name | Type | Default | Description |\n| --- | --- | --- | --- |`;
  const mdRows = props.map((p) => {
    const required = p.required ? ' \\*' : '';
    const type = formatType(p.type).replace(/\|/g, '\\|');
    const def =
      p.defaultValue?.value !== undefined && p.defaultValue?.value !== null
        ? `\`${String(p.defaultValue.value).replace(/\|/g, '\\|')}\``
        : '—';
    const desc = (p.description ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    return `| \`${p.name}\`${required} | \`${type}\` | ${def} | ${desc} |`;
  });
  const tableMarkdown = `${mdHeader}\n${mdRows.join('\n')}`;

  const headerHtml =
    '<thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>';
  const rowsHtml = props
    .map((p) => {
      const requiredMark = p.required
        ? '<span class="markbook-required" title="required">*</span>'
        : '';
      const def =
        p.defaultValue?.value !== undefined && p.defaultValue?.value !== null
          ? `<code>${escapeHtml(String(p.defaultValue.value))}</code>`
          : '—';
      return `<tr><td><code>${escapeHtml(p.name)}</code>${requiredMark}</td><td><code>${escapeHtml(formatType(p.type))}</code></td><td>${def}</td><td>${escapeHtml(p.description ?? '')}</td></tr>`;
    })
    .join('');
  const tableHtml = `<table class="markbook-props">${headerHtml}<tbody>${rowsHtml}</tbody></table>`;

  return { tableHtml, tableMarkdown };
}

function formatType(t: { name?: string; value?: unknown; raw?: string } | undefined): string {
  if (!t) return '';
  if (t.name === 'enum' && Array.isArray(t.value)) {
    return (t.value as Array<{ value?: string }>)
      .map((v) => v.value ?? '')
      .filter(Boolean)
      .join(' | ');
  }
  return t.raw ?? t.name ?? '';
}

function findTsConfig(start: string): string | null {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, 'tsconfig.json');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
