import path from 'node:path';
import { createRequire } from 'node:module';

/**
 * Resolve a path-like specifier to an absolute file path. Three input shapes
 * are recognised:
 *
 *   - relative: `'./Foo.tsx'` / `'../Bar'` → `path.resolve(fromDir, spec)`
 *   - absolute: `'/abs/path'` → returned as-is
 *   - bare:     `'@my-org/button'` / `'lib'` → Node module resolution
 *     starting from `fromDir`
 *
 * Returns `null` when a bare specifier cannot be resolved (e.g. the package
 * is not installed). Relative and absolute specifiers always return a path
 * — the caller is responsible for checking it exists.
 *
 * Used at the parse/build boundary so downstream consumers (code extractor,
 * props extractor, entry generator) keep working with absolute paths.
 */
export function resolveSpec(spec: string, fromDir: string): string | null {
  if (spec.startsWith('./') || spec.startsWith('../') || path.isAbsolute(spec)) {
    return path.resolve(fromDir, spec);
  }
  // Bare specifier — resolve via Node's module resolution algorithm.
  // createRequire needs a real file path (not a directory) as the base; we
  // synthesize a fake `package.json` path inside the directory so resolution
  // walks up from there.
  const require = createRequire(path.join(fromDir, 'package.json'));
  try {
    return require.resolve(spec);
  } catch {
    return null;
  }
}

/** True when the spec is a relative or absolute filesystem path, not a bare module name. */
export function isPathLikeSpec(spec: string): boolean {
  return spec.startsWith('./') || spec.startsWith('../') || path.isAbsolute(spec);
}
