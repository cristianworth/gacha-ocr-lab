import sharp from 'sharp';

const point = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`;
function star(cx, cy, radius = 10) {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const distance = index % 2 ? radius * 0.45 : radius;
    return point(cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance);
  }).join(' ');
}
const encode = (svg) => sharp(Buffer.from(svg)).png().toBuffer();
export async function scene({ columns = 6, selected = 0, omit = null, level = 90, partial = true, scrollbar = 'top', identicalArt = false, pitch = 110, yOffset = 0, faintTrack = false, outlineOpacity = 1, portrait = false, missingSide = null, rarity = 5, panelText = 'Synthetic Sword' } = {}) {
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900"><defs><clipPath id="grid"><rect x="70" y="80" width="888" height="730"/></clipPath></defs><rect width="1440" height="900" fill="#30303a"/><g clip-path="url(#grid)">';
  for (let row = 0; row < (partial ? 6 : 5); row += 1) for (let column = 0; column < columns; column += 1) {
    if (omit?.row === row && omit?.column === column) continue;
    const x = 87 + column * pitch; const y = 90 + row * 131 + yOffset;
    const id = row * columns + column;
    if (selected === id && outlineOpacity === 1 && !portrait && !missingSide) svg += `<rect x="${x - 4}" y="${y - 4}" width="100" height="123" rx="4" fill="none" stroke="white" stroke-width="3"/>`;
    svg += `<rect x="${x}" y="${y}" width="92" height="115" rx="3" fill="#9268a4"/><path d="M${x + 16} ${y + 78} L${x + 57} ${y + 22} L${x + (identicalArt ? 75 : 65 + (id % 17))} ${y + 69} Z" fill="#493963"/><path d="M${x + 20} ${y + 70} L${x + 72} ${y + 26}" stroke="#d9c998" stroke-width="6"/><rect x="${x}" y="${y + 95}" width="92" height="20" fill="#ebe6d8"/><text x="${x + 22}" y="${y + 111}" font-family="Arial" font-size="14" fill="#30303a">Lv. ${level}</text>`;
    if (selected === id && (outlineOpacity !== 1 || portrait || missingSide)) {
      const left = x - 1, right = x + 93, top = y - 1, bottom = y + 115;
      const segments = { top: `M${left} ${top} H${right}`, bottom: `M${left} ${bottom} H${right}`,
        left: `M${left} ${top} V${bottom}`, right: `M${right} ${top} V${bottom}` };
      svg += `<path d="${Object.entries(segments).filter(([side]) => side !== missingSide).map(([, line]) => line).join(' ')}" fill="none" stroke="white" stroke-width="3" opacity="${outlineOpacity}"/>`;
    }
    if (portrait) svg += `<rect x="${x + 64}" y="${y - 8}" width="35" height="44" fill="#435980"/>`;
  }
  svg += '</g>';
  svg += `<rect x="980" y="90" width="370" height="722" fill="#b96b35"/><rect x="980" y="302" width="370" height="510" fill="#ece5d5"/>`;
  for (let index = 0; index < rarity; index += 1) svg += `<polygon points="${star(1012 + index * 26, 280)}" fill="#ffcc32"/>`;
  svg += `<text x="1000" y="120" font-family="Arial" font-size="26" fill="white">${panelText}</text><text x="1000" y="153" font-family="Arial" font-size="20" fill="#eee">Bow</text><text x="1000" y="335" font-family="Arial" font-size="20" fill="#30303a">Lv. 90/90</text><text x="1000" y="370" font-family="Arial" font-size="20" fill="#b98f48">Refinement Rank 1</text>`;
  if (scrollbar) {
    const top = scrollbar === 'top' ? 90 : scrollbar === 'bottom' ? 674 : 300;
    svg += `<rect x="964" y="90" width="3" height="710" fill="${faintTrack ? '#2b2b35' : '#17171c'}"/><rect x="963" y="${top}" width="5" height="126" rx="1" fill="#c8c1b6"/>`;
  }
  return encode(`${svg}</svg>`);
}
export async function card(count, { malformed = false, shifted = false } = {}) {
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="370" height="722"><rect width="370" height="722" fill="#9665b3"/>';
  for (let index = 0; index < count; index += 1) svg += `<polygon points="${star(32 + index * 26 + (shifted ? 26 : 0), 190)}" fill="#ffcc32"/>`;
  if (malformed) svg += '<rect x="18" y="180" width="140" height="15" fill="#ffcc32"/>';
  return encode(`${svg}</svg>`);
}
