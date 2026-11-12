import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';

const cities = JSON.parse(readFileSync(new URL('../src/cities.json', import.meta.url), 'utf8'));

export const playerIdFor = secret => typeof secret === 'string' && /^[a-f0-9]{64}$/.test(secret)
  ? createHash('sha256').update(secret).digest('hex').slice(0, 12).toUpperCase()
  : undefined;

export function createCircuit(file) {
  let records = {};
  if (file) {
    try { records = JSON.parse(readFileSync(file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }

  const progress = id => records[id] ?? {};
  const canEnter = (id, cityId) => {
    const city = cities.find(entry => entry.id === cityId);
    return Boolean(city && (!city.requires || progress(id)[city.requires]?.wins));
  };

  function finish(room, winner) {
    if (!room.city || room.result) return room.result;
    const winnerId = winner === 0 ? room.hostId : room.guestId;
    const firstWin = !progress(winnerId)[room.city]?.wins;
    const updated = { ...records };
    for (const id of [room.hostId, room.guestId]) {
      const old = progress(id)[room.city] ?? { wins: 0, losses: 0 };
      updated[id] = {
        ...progress(id),
        [room.city]: { wins: old.wins + Number(id === winnerId), losses: old.losses + Number(id !== winnerId) },
      };
    }
    if (file) {
      writeFileSync(file + '.tmp', JSON.stringify(updated));
      renameSync(file + '.tmp', file);
    }
    records = updated;
    return room.result = { winner, firstWin };
  }

  function handleRequest(request, response) {
    if (request.method !== 'POST' || request.url?.split('?')[0] !== '/circuit-progress') return false;
    const id = playerIdFor(request.headers['x-player-secret']);
    if (!id) response.writeHead(400).end();
    else response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(progress(id)));
    return true;
  }

  return { canEnter, finish, handleRequest };
}
