let sequence = 0;
const colors = ['#fff9e9', '#ffc526', '#2468df', '#eb3045', '#8645ce', '#ff8b25', '#159c64', '#8c2941', '#111724'];
export function ballArtwork(i: number, snooker = false, onTable = false) {
  const id = 'ball-art-' + sequence++;
  const color = snooker && i > 0 ? i <= 15 ? '#df253d' : ['#f5ca25','#148650','#8a4e29','#246cce','#ed83b0','#111724'][i-16] : colors[i > 8 ? i-8 : i];
  const defs = '<defs><radialGradient id="'+id+'-resin" cx=".3" cy=".23" r=".85"><stop stop-color="#fff" stop-opacity=".54"/><stop offset=".38" stop-color="#fff" stop-opacity=".03"/><stop offset=".7" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></radialGradient><radialGradient id="'+id+'-contact"><stop stop-color="#000" stop-opacity=".65"/><stop offset=".65" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient><clipPath id="'+id+'-clip"><circle r="35"/></clipPath></defs>';
  const caps = !snooker && i > 8 ? '<path class="sv-ball-caps" d="M-36 -17H36V-36H-36Z M-36 17H36V36H-36Z" fill="#fff8e9"/>' : '';
  const mark = !snooker && i
    ? '<circle r="15" fill="#fff9ea"/><text text-anchor="middle" dominant-baseline="central" fill="#141a22" font-family="Arial,sans-serif" font-size="19" font-weight="700">'+i+'</text>'
    : onTable && i === 0 ? '<circle r="2.6" fill="#a6342c"/>' : '';
  return defs + `<ellipse cx="5" cy="9" rx="46" ry="43" fill="url(#${id}-contact)"/><circle r="35" fill="${color}"/><g clip-path="url(#${id}-clip)">${caps}<g class="sv-ball-mark">${mark}</g></g><circle r="35" fill="url(#${id}-resin)"/><ellipse cx="-11" cy="-16" rx="9" ry="5" transform="rotate(-35 -11 -16)" fill="#fff" opacity=".55"/><circle r="34.5" fill="none" stroke="#000" stroke-opacity=".25"/>`;
}
export function ballBadge(i: number, snooker = false) {
  const badge = document.createElement('span');
  badge.className = 'score-ball svg-ball-badge';
  badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-38 -38 76 82" aria-hidden="true">' + ballArtwork(i, snooker) + '</svg>';
  return badge;
}
