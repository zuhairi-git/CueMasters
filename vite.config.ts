import { defineConfig } from 'vite';
import { attachOnline } from './server/online.mjs';
import { createCircuit } from './server/circuit.mjs';

function configureCircuit(server) {
  const circuit = createCircuit(process.env.CIRCUIT_DATA_FILE || '.billiard-circuit.json');
  server.middlewares.use((request, response, next) => {
    if (!circuit.handleRequest(request, response)) next();
  });
  if (server.httpServer) attachOnline(server.httpServer, circuit);
}

export default defineConfig({
  base: './',
  build: { target: 'es2018' },
  server: { host: '0.0.0.0' },
  plugins: [{
    name: 'billiard-online',
    configureServer: configureCircuit,
    configurePreviewServer: configureCircuit,
  }],
});
