import { gameExample } from './game-api';

export const scriptLanguages: Record<string, string> = {
  '.py': 'Python', '.c': 'C', '.h': 'C / C++', '.cc': 'C++',
  '.cpp': 'C++', '.cxx': 'C++', '.hpp': 'C++', '.js': 'JavaScript',
  '.mjs': 'JavaScript', '.ts': 'TypeScript', '.lua': 'Lua', '.cs': 'C#',
};
export const movementLanguages = [
  { language: 'Python', extension: '.py' },
  { language: 'C', extension: '.c' },
  { language: 'C++', extension: '.cpp' },
  { language: 'JavaScript', extension: '.js' },
  { language: 'TypeScript', extension: '.ts' },
  { language: 'Lua', extension: '.lua' },
  { language: 'C#', extension: '.cs' },
] as const;
export const maxScriptSize = 256 * 1024;
export const maxProjectScriptsSize = 1024 * 1024;
export type ScriptFile = {
  id: string; name: string; language: string; size: number; content: string;
};
export const sourceSize = (content: string) => new TextEncoder().encode(content).byteLength;

export function isScriptFileCollection(value: unknown): value is ScriptFile[] {
  if (!Array.isArray(value) || value.length > 100) return false;
  const ids = new Set<string>();
  let totalSize = 0;
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const script = entry as Partial<ScriptFile>;
    if (typeof script.id !== 'string' || !script.id || ids.has(script.id) ||
        typeof script.name !== 'string' || !script.name || script.name.length > 160 ||
        typeof script.language !== 'string' || !Object.values(scriptLanguages).includes(script.language) ||
        typeof script.content !== 'string' || script.content.includes('\u0000') ||
        typeof script.size !== 'number' || !Number.isInteger(script.size)) return false;
    const size = sourceSize(script.content);
    if (size !== script.size || size > maxScriptSize) return false;
    ids.add(script.id);
    totalSize += size;
    if (totalSize > maxProjectScriptsSize) return false;
  }
  return true;
}

export function scriptStorageError(content: string, scripts: ScriptFile[], replacingId?: string): string {
  if (content.includes('\u0000')) return 'Scripts must be plain text (no null characters).';
  const size = sourceSize(content);
  if (size > maxScriptSize) return 'Scripts must be 256 KB or smaller. Change not saved.';
  const total = scripts.reduce((sum, script) => sum + (script.id === replacingId ? 0 : script.size), 0);
  if (total + size > maxProjectScriptsSize) return 'This project has reached its 1 MB script storage limit. Change not saved.';
  return '';
}

export function movementStarter(language: string, scripts: ScriptFile[]): Omit<ScriptFile, 'id'> {
  const entry = movementLanguages.find((entry) => entry.language === language);
  if (!entry) throw new Error('Unsupported starter language');
  let name = `movement${entry.extension}`;
  for (let i = 2; scripts.some((script) => script.name.toLowerCase() === name.toLowerCase()); i++) {
    name = `movement-${i}${entry.extension}`;
  }
  const content = `${gameExample(language)}\n`;
  return { name, language, content, size: sourceSize(content) };
}
