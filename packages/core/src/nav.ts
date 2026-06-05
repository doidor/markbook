import type { PageRecord } from './build.js';

export interface NavItem {
  id: string;
  title: string;
  htmlRelPath: string;
  /**
   * Explicit sort key from frontmatter `order:`. When set on at least one
   * sibling, ordered pages appear before unordered ones, sorted ascending
   * by `order`. Unordered pages preserve their existing file-discovery
   * order (alphabetical by file path) — adding `order:` to one page does
   * not silently reshuffle the others.
   */
  order?: number;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/**
 * Group pages into sidebar nav sections by their top-level directory
 * (`groupKey`), sort each section, and order the ungrouped section first.
 */
export function buildNav(pages: PageRecord[]): NavGroup[] {
  const groupMap = new Map<string | null, NavItem[]>();
  for (const p of pages) {
    if (!groupMap.has(p.groupKey)) groupMap.set(p.groupKey, []);
    const rawOrder = p.parsed.frontmatter.order;
    const order = typeof rawOrder === 'number' && Number.isFinite(rawOrder) ? rawOrder : undefined;
    groupMap.get(p.groupKey)!.push({
      id: p.fileId,
      title: p.parsed.title,
      htmlRelPath: p.htmlRelPath,
      order,
    });
  }
  const groups: NavGroup[] = [];
  if (groupMap.has(null)) {
    groups.push({ label: null, items: sortNavItems(groupMap.get(null)!) });
  }
  const named = [...groupMap.entries()]
    .filter(([k]) => k !== null)
    .sort(([a], [b]) => (a as string).localeCompare(b as string));
  for (const [k, v] of named) {
    groups.push({ label: k as string, items: sortNavItems(v) });
  }
  return groups;
}

/**
 * Sort sidebar items: index page first, then frontmatter-ordered pages
 * ascending, then any pages without `order:` in their original
 * file-discovery order (stable). Ties on `order` also fall back to
 * file-discovery order. The stability matters: users who rely on
 * filename prefixes for sort order (`01-intro.md`, `02-setup.md`)
 * don't get silently reshuffled by adding `order:` to one sibling.
 */
export function sortNavItems(items: NavItem[]): NavItem[] {
  const indexed = items.map((item, originalIndex) => ({ item, originalIndex }));
  indexed.sort((a, b) => {
    const aIdx = isIndexHref(a.item.htmlRelPath);
    const bIdx = isIndexHref(b.item.htmlRelPath);
    if (aIdx !== bIdx) return aIdx ? -1 : 1;

    const aOrdered = a.item.order !== undefined;
    const bOrdered = b.item.order !== undefined;
    if (aOrdered !== bOrdered) return aOrdered ? -1 : 1;
    if (aOrdered && bOrdered && a.item.order !== b.item.order) {
      return (a.item.order as number) - (b.item.order as number);
    }

    return a.originalIndex - b.originalIndex;
  });
  return indexed.map(({ item }) => item);
}

/** @deprecated Use `sortNavItems`. Kept as a thin alias for backward compatibility with any consumer reaching into the internals. */
export function sortIndexFirst(items: NavItem[]): NavItem[] {
  return sortNavItems(items);
}

export function isIndexHref(href: string): boolean {
  return href === 'index.html' || href.endsWith('/index.html');
}

/** Upper-case the first character of a string (used for nav group labels / link text). */
export function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}
