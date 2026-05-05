import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { ConfigSchema, type Config } from '$lib/schemas/config';
import { CONFIG_PATH } from './paths';

// Cache by mtime so each request doesn't re-parse the file.
let cache: { mtimeMs: number; config: Config | null } | null = null;

async function readAndValidate(): Promise<Config | null> {
  let raw: string;
  try {
    raw = await readFile(CONFIG_PATH, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
  const parsed = yamlParse(raw);
  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    console.error(
      `[config] ${CONFIG_PATH} failed validation; treating as not-set-up. Issues:`,
      result.error.issues
    );
    return null;
  }
  return result.data;
}

export async function loadConfig(): Promise<Config | null> {
  let st: Awaited<ReturnType<typeof stat>>;
  try {
    st = await stat(CONFIG_PATH);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      cache = null;
      return null;
    }
    throw e;
  }
  if (cache && cache.mtimeMs === st.mtimeMs) return cache.config;
  const config = await readAndValidate();
  cache = { mtimeMs: st.mtimeMs, config };
  return config;
}

export async function isSetupComplete(): Promise<boolean> {
  const cfg = await loadConfig();
  return cfg?.setup_complete === true;
}

export async function writeConfig(cfg: Config): Promise<void> {
  const validated = ConfigSchema.parse(cfg);
  const dir = dirname(CONFIG_PATH);
  await mkdir(dir, { recursive: true });
  const tmp = `${CONFIG_PATH}.tmp`;
  await writeFile(tmp, yamlStringify(validated), { mode: 0o600 });
  await rename(tmp, CONFIG_PATH);
  cache = null;
}

export function invalidateConfigCache(): void {
  cache = null;
}
