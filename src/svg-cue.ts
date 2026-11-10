let sequence = 0;
export function cueArtwork(style: string, softShadow = false) {
  const id = 'cue-art-' + sequence++;
  const carbon = style === 'Carbon Black';
  const rosewood = style === 'Rosewood';
  const butt = carbon ? '#111a27' : rosewood ? '#652d32' : '#653d29';
  const stops = carbon ? ['#8494a5','#303d4c','#657586','#182333'] : rosewood ? ['#efc295','#b57551','#f2ce9d','#80452d'] : ['#ffeab6','#e5b86e','#fff0c5','#99682e'];
  const shadowFilter = softShadow
    ? `<filter id="${id}-shadow" filterUnits="userSpaceOnUse" x="-1280" y="-30" width="1320" height="90"><feGaussianBlur stdDeviation="7"/></filter>`
    : '';
  const shadow = softShadow
    ? `<path d="M-1248 4L2 2V8L-1248 24Z" fill="#061019" opacity=".45" filter="url(#${id}-shadow)"/>`
    : '<path d="M-1250 -10L0 -3V3L-1250 10Z" fill="#000" opacity=".25" transform="translate(2 8)"/>';
  return '<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop stop-color="'+stops[0]+'"/><stop offset=".35" stop-color="'+stops[1]+'"/><stop offset=".65" stop-color="'+stops[2]+'"/><stop offset="1" stop-color="'+stops[3]+'"/></linearGradient>'+shadowFilter+'</defs>' +
    shadow+'<path d="M-1250 -10L0 -3V3L-1250 10Z" fill="url(#'+id+')"/><path d="M-1250 -10L-850 -7.8V7.8L-1250 10Z" fill="'+butt+'"/><path d="M-1000 -8.5V8.5 M-860 -7.8V7.8" stroke="#d9c18c" stroke-width="6"/><path d="M-842 -7.6L-700 0L-842 7.6Z" fill="'+butt+'"/><path d="M-18 -3.1H-4V3.1H-18Z" fill="#fff4d6"/><path d="M-4 -3H0V3H-4Z" fill="#48a1ba"/>';
}
