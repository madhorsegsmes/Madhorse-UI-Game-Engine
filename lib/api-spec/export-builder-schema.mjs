import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'yaml';

// Both the SDK schema and Zod validators derive from the same API contract.
// Inline refs so the AI endpoint needs no external schema resolution.
const spec = parse(await readFile(new URL('./openapi.yaml', import.meta.url), 'utf8'));
function inline(value) {
  if (Array.isArray(value)) return value.map(inline);
  if (!value || typeof value !== 'object') return value;
  if (value.$ref) return inline(spec.components.schemas[value.$ref.split('/').at(-1)]);
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, inline(item)]));
  if (result.type === 'object') result.additionalProperties = false;
  return result;
}
const schema = inline(spec.components.schemas.MadBuilderPlan);
await writeFile(new URL('../api-zod/src/generated/mad-builder-schema.ts', import.meta.url),
  `// Generated from openapi.yaml. Do not edit by hand.\nexport const builderPlanJsonSchema: Record<string, unknown> = ${JSON.stringify(schema, null, 2)};\n`);

for (const path of ['../api-client-react/src/generated/api.ts', '../api-client-react/src/generated/api.schemas.ts', '../api-zod/src/generated/api.ts']) {
  const url = new URL(path, import.meta.url);
  await writeFile(url, (await readFile(url, 'utf8')).trimEnd() + '\n');
}
