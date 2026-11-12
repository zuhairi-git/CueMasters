import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const urls = new Map();
export async function sourceUrl(name) {
  if (urls.has(name)) return urls.get(name);
  if (name.endsWith('.json')) {
    const json = await readFile(new URL('../src/' + name, import.meta.url), 'utf8');
    const url = 'data:text/javascript;base64,' + Buffer.from('export default ' + json).toString('base64');
    urls.set(name, url);
    return url;
  }
  const source = await readFile(new URL('../src/' + name + '.ts', import.meta.url), 'utf8');
  let js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const imports = [...js.matchAll(/from ['"]\.\/([^'"]+)['"]/g)];
  for (const match of imports) js = js.replace(match[0], 'from ' + JSON.stringify(await sourceUrl(match[1])));
  const url = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
  urls.set(name, url);
  return url;
}
export async function loadSource(name) { return import(await sourceUrl(name)); }
