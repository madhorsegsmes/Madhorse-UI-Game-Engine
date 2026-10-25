// Original GBC-era inspired pixel art for the Madhorse 2D RPG starter.
// Each sprite is a character map; each char indexes a shared limited palette.

export type PixelRpgSpriteKind =
  | 'meadow' | 'path' | 'water' | 'tree' | 'house' | 'clinic' | 'player'
  | 'guide' | 'grass' | 'fence' | 'sign' | 'mosskit' | 'cindlet' | 'ball';

const PALETTE: Record<string, string> = {
  k: '#1f1a2e', // ink outline
  g: '#7cc46a', G: '#4f9a52', d: '#2f6b45', l: '#b5e08a', // greens
  p: '#e6cf98', P: '#c9a96a', o: '#9a7646', // path / wood
  w: '#5aa6e8', W: '#3a74c4', f: '#bfe4fb', // water
  r: '#d8584a', R: '#9c3443', // red roof
  b: '#4a7ad0', B: '#2f4f96', // blue roof / clothing
  c: '#f4ead2', C: '#d6c7a4', // cream wall
  s: '#f2c49b', h: '#6b3d2e', y: '#f6d14a', Y: '#d99a2b', // skin, hair, yellow
  m: '#e98c3a', n: '#a8b0bc', // ember orange, stone
};

const SPRITES: Record<PixelRpgSpriteKind, string[]> = {
  meadow: [
    'gggggggggggggggg', 'gggGgggggggggggg', 'ggGgGggggggglggg', 'gggggggggggggggg',
    'gggggggggGgggggg', 'gglgggggGgGggggg', 'gggggggggggggggg', 'ggggggggggggggGg',
    'gggggggggggggGgG', 'ggggGggggggggggg', 'gggGgGgggglggggg', 'gggggggggggggggg',
    'glgggggggggggggg', 'gggggggggGgggggg', 'ggggggggGgGggggg', 'gggggggggggggggg',
  ],
  path: [
    'pppppppppppppppp', 'pppPpppppppppppp', 'pppppppppppoPppp', 'pppppppppppppppp',
    'ppppppPpppppppPp', 'pPpppppppppppppp', 'pppppppppPpppppp', 'ppppoppppppppppp',
    'pppppppppppppppp', 'pppppppPpppppPpp', 'ppPppppppppppppp', 'pppppppppppppppp',
    'ppppppppppoppppp', 'pppPppppppppppPp', 'pppppppppppppppp', 'pppppppPpppppppp',
  ],
  water: [
    'wwwwwwwwwwwwwwww', 'wwffwwwwwwwwwwww', 'wwwwffwwwwwwwwWw', 'wwwwwwwwwwwwwwww',
    'wwwwwwwwwwffwwww', 'wWwwwwwwwwwwffww', 'wwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwww',
    'wwwffwwwwwwwwwww', 'wwwwwffwwwwWwwww', 'wwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwww',
    'wwwwwwwwwwwffwww', 'wwWwwwwwwwwwwffw', 'wwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwww',
  ],
  grass: [
    'GgGgGgGgGgGgGgGg', 'dGdGdGdGdGdGdGdG', 'GlGgGlGgGlGgGlGg', 'dGdGdGdGdGdGdGdG',
    'gGdGgGdGgGdGgGdG', 'GdGlGdGlGdGlGdGl', 'dGdGdGdGdGdGdGdG', 'GgGgGgGgGgGgGgGg',
    'GgGgGgGgGgGgGgGg', 'dGdGdGdGdGdGdGdG', 'GlGgGlGgGlGgGlGg', 'dGdGdGdGdGdGdGdG',
    'gGdGgGdGgGdGgGdG', 'GdGlGdGlGdGlGdGl', 'dGdGdGdGdGdGdGdG', 'GgGgGgGgGgGgGgGg',
  ],
  tree: [
    '.....kkkkkk.....', '...kkllGGGGkk...', '..klllGGGGGGGk..', '.kllGGGGGGGGGGk.',
    '.klGGGGGlGGGGGk.', 'kGGGGGllGGGGGGdk', 'kGGlGGGGGGGGGddk', 'kGGGGGGGGGGGdddk',
    '.kdGGGGGGGGGddk.', '.kddGGGGGGdddddk', '..kdddddddddddk.', '...kkkdddddkk...',
    '......kook......', '......kook......', '.....kGoooGk....', '......kkkk......',
  ],
  fence: [
    '................', '................', '..kk........kk..', '.kCck......kCck.',
    '.kcck......kcck.', 'kkcckkkkkkkkcckk', 'kCCCCCCCCCCCCCCk', 'kkcckkkkkkkkcckk',
    '.kcck......kcck.', 'kkcckkkkkkkkcckk', 'kCCCCCCCCCCCCCCk', 'kkcckkkkkkkkcckk',
    '.kcck......kcck.', '.kCCk......kCCk.', '.kkkk......kkkk.', '................',
  ],
  sign: [
    '................', '................', '.kkkkkkkkkkkkkk.', '.kPPPPPPPPPPPPk.',
    '.kPokkoPokoPPPk.', '.kPPPPPPPPPPPPk.', '.kPokoPPokkoPPk.', '.kPPPPPPPPPPPPk.',
    '.koooooooooooook', '.kkkkkkookkkkkk.', '......kook......', '......kook......',
    '......kook......', '.....GkookG.....', '......kkkk......', '................',
  ],
  player: [
    '.....kkkkkk.....', '....kRRRRRRk....', '...kRrrrrrrRk...', '...kRrrrrrrRk...',
    '...kkkkkkkkkk...', '...khsssssshk...', '...kskssskssk...', '....ksssssk.....',
    '...kkbbbbbbkk...', '..ksbbbyybbbsk..', '..ksbbbbbbbbsk..', '...kkBBBBBBkk...',
    '....kBBkkBBk....', '....kBBkkBBk....', '....kkk..kkk....', '................',
  ],
  guide: [
    '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khsssssshk...',
    '...kskssskssk...', '...khsssssshkk..', '....kssnnssk....', '...kkGGGGGGkk...',
    '..ksGGGcGGGGsk..', '..ksGGGcGGGGsk..', '..kkGGGGGGGGkk..', '...kPPPPPPPPk...',
    '...kPPPPPPPPk...', '....kPPkkPPk....', '....kkk..kkk....', '................',
  ],
  mosskit: [
    '..k..........k..', '.kGk........kGk.', '.kGGk.kkkk.kGGk.', '.kGlGkGGGGkGlGk.',
    '..kGGGGlGGGGGk..', '..kGGGGGGGGGGk..', '.kGGkfGGGGkfGGk.', '.kGGkkGGGGkkGGk.',
    '.kGGGGGrrGGGGGk.', '..kGGGGGGGGGGk..', '.kllGGGGGGGGllk.', 'kllldGGGGGGdlllk',
    '.kkldGGGGGGdlkk.', '...kGGkkkkGGk...', '...kkk....kkk...', '................',
  ],
  cindlet: [
    '.......k........', '......kyk.......', '.....kyYmk......', '....kymmmmk.....',
    '...kmmmkkmmk....', '..kmmmmmmmmmk...', '..kmmkfmmkfmk...', '..kmmkkmmkkmk...',
    '..kmmmmmmmmmmk..', '..kmmmcccmmmmk..', '...kmcccccmmk.kk', '...kmmccmmmmkkyk',
    '....kmmmmmmmkymk', '....kRkkkRkkmk..', '....kkk.kkkk....', '................',
  ],
  ball: [
    '................', '.....kkkkkk.....', '...kkbbbbbbkk...', '..kbbfbbbbbbbk..',
    '..kbfbbbbbbbbk..', '.kbbbbbbbbbbbbk.', '.kbbbbbkkbbbbbk.', '.kkkkkkcckkkkkk.',
    '.kcccccckccccck.', '.kccccckkccccck.', '.kcccccccccCCck.', '..kcccccccCCck..',
    '..kCcccccCCCCk..', '...kkCCCCCCkk...', '.....kkkkkk.....', '................',
  ],
  house: houseRows('r', 'R'),
  clinic: houseRows('b', 'B', true),
};

function houseRows(roof: string, roofDark: string, emblem = false): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 14; y++) {
    const inset = Math.max(0, 7 - y);
    const left = 2 + inset;
    const width = 28 - inset * 2;
    const fill = Array.from({ length: width }, (_, i) =>
      i === 0 || i === width - 1 || y === 0 ? 'k' : (y + i) % 4 === 0 ? roofDark : roof).join('');
    rows.push('.'.repeat(left) + fill + '.'.repeat(32 - left - width));
  }
  rows.push('..' + 'k'.repeat(28) + '..');
  const win = 'kfWk';
  for (let y = 0; y < 15; y++) {
    let line = ('..kC' + 'c'.repeat(24) + 'Ck..').split('');
    if (y >= 2 && y <= 5) { win.split('').forEach((c, i) => { line[5 + i] = c; line[23 + i] = c; }); }
    if (y === 2 || y === 5) { for (let i = 5; i < 9; i++) line[i] = line[i + 18] = 'k'; }
    if (y >= 6) { for (let i = 13; i < 19; i++) line[i] = i === 13 || i === 18 || y === 6 ? 'k' : y === 10 && i === 17 ? 'y' : 'o'; }
    if (emblem && y <= 4) {
      const leaf = ['..GG..', '.GlGG.', 'GGbbGd', '.GddG.', '..dd..'][y];
      leaf.split('').forEach((c, i) => { if (c !== '.') line[13 + i] = c; });
    }
    if (y === 14) line = ('..' + 'k'.repeat(11) + 'nnnnnn' + 'k'.repeat(11) + '..').split('');
    rows.push(line.join(''));
  }
  rows.push('.'.repeat(32), '.'.repeat(32));
  return rows.slice(0, 32);
}

function toSvg(rows: string[]): string {
  const size = rows.length;
  rows.forEach((row, y) => {
    if (row.length !== size) throw new Error(`pixel-rpg-art: row ${y} is ${row.length} wide, expected ${size}`);
    for (const ch of row) if (ch !== '.' && !PALETTE[ch]) throw new Error(`pixel-rpg-art: unknown symbol "${ch}"`);
  });
  const rects: string[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < size) {
      const ch = row[x] ?? '.';
      let run = 1;
      while (x + run < size && row[x + run] === ch) run++;
      const color = PALETTE[ch];
      if (color) rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${color}"/>`);
      x += run;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

const cache = new Map<PixelRpgSpriteKind, string>();

export function pixelRpgSpriteSvg(kind: PixelRpgSpriteKind): string {
  let svg = cache.get(kind);
  if (!svg) { svg = toSvg(SPRITES[kind]); cache.set(kind, svg); }
  return svg;
}
