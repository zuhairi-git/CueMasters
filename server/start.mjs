import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachOnline } from './online.mjs';
import { createCircuit } from './circuit.mjs';

const circuit = createCircuit(process.env.CIRCUIT_DATA_FILE || '.billiard-circuit.json');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (request, response) => {
  if (circuit.handleRequest(request, response)) return;
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(resolve(root) + sep)) { response.writeHead(403).end(); return; }
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    response.end(content);
  } catch { response.writeHead(404).end('Not found'); }
});
attachOnline(server, circuit);
server.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => console.log('Billiard server listening on port ' + server.address().port));
