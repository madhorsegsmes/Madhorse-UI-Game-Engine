/** Original vector fantasy card art. Self-contained square SVG, no remote refs or scripts. */
const safeColor = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : '#6b5bd6');

function shade(hex: string, amt: number) {
  let h = safeColor(hex).slice(1);
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h.slice(0, 6), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const SUBJECTS: Record<string, string> = {
  dragon: `<path d="M40 150 C60 90 90 70 128 62 C150 58 170 66 182 80 L206 70 L194 96 C200 112 196 130 182 140 L150 150 C138 170 112 186 84 186 Z" fill="url(#m)"/>
<path d="M98 92 L46 34 L76 96 L30 76 L84 120 Z" fill="url(#h)" opacity=".9"/>
<path d="M150 96 L210 28 L180 104 L226 92 L166 128 Z" fill="url(#h)" opacity=".75"/>
<circle cx="176" cy="92" r="5" fill="#fff5c0"/><path d="M196 104 l26 8 -26 6z" fill="#ffb347"/>
<path d="M60 186 q20 -18 44 0 M110 186 q20 -18 44 0" stroke="#fff3" stroke-width="4" fill="none"/>`,
  golem: `<rect x="78" y="58" width="100" height="92" rx="14" fill="url(#m)"/><rect x="104" y="30" width="48" height="40" rx="8" fill="url(#h)"/>
<circle cx="118" cy="50" r="5" fill="#9ff"/><circle cx="138" cy="50" r="5" fill="#9ff"/>
<rect x="40" y="70" width="36" height="78" rx="12" fill="url(#h)"/><rect x="180" y="70" width="36" height="78" rx="12" fill="url(#h)"/>
<rect x="88" y="150" width="32" height="56" rx="8" fill="url(#h)"/><rect x="136" y="150" width="32" height="56" rx="8" fill="url(#h)"/>
<path d="M100 84 l20 18 -6 22 M150 80 l-12 30 18 14" stroke="#9ff" stroke-width="3" fill="none" opacity=".8"/>`,
  mage: `<path d="M128 22 L168 104 H88 Z" fill="url(#h)"/><circle cx="128" cy="112" r="20" fill="#f3d9b8"/>
<path d="M84 220 L104 128 H152 L172 220 Z" fill="url(#m)"/><path d="M96 104 h64" stroke="#ffd56b" stroke-width="6"/>
<line x1="186" y1="60" x2="176" y2="214" stroke="#d9b36a" stroke-width="6"/><circle cx="187" cy="56" r="14" fill="url(#g)"/>
<circle cx="120" cy="112" r="3" fill="#223"/><circle cx="136" cy="112" r="3" fill="#223"/>`,
  wolf: `<path d="M40 190 C50 140 80 112 120 104 L146 54 L158 92 L176 60 L180 104 C206 116 222 140 220 160 L190 170 C170 196 120 206 80 200 Z" fill="url(#m)"/>
<path d="M180 116 L226 140 L196 150 Z" fill="url(#h)"/><circle cx="172" cy="118" r="5" fill="#ffe066"/>
<path d="M70 168 q30 -24 60 -8 q30 -20 56 4" stroke="#fff4" stroke-width="4" fill="none"/>`,
  knight: `<path d="M98 50 Q128 18 158 50 V92 H98 Z" fill="url(#h)"/><rect x="108" y="66" width="40" height="8" fill="#123"/>
<path d="M150 30 q30 -10 40 18 q-20 -6 -36 4z" fill="#e2534f"/><path d="M86 96 H170 L178 208 H78 Z" fill="url(#m)"/>
<path d="M40 104 h52 v54 q-26 30 -52 0z" fill="url(#h)" stroke="#ffd56b" stroke-width="4"/>
<line x1="196" y1="36" x2="196" y2="196" stroke="#e8eef8" stroke-width="7"/><rect x="182" y="150" width="28" height="7" fill="#d9b36a"/>`,
  phoenix: `<path d="M128 60 C160 90 220 70 236 30 C230 100 190 140 140 150 C170 170 160 210 128 228 C96 210 86 170 116 150 C66 140 26 100 20 30 C36 70 96 90 128 60 Z" fill="url(#m)"/>
<circle cx="128" cy="76" r="16" fill="url(#h)"/><path d="M128 64 l6 -26 6 22z" fill="#ffd56b"/>
<path d="M100 120 q28 30 56 0" stroke="#ffe9a8" stroke-width="5" fill="none"/>`,
  heal: `<circle cx="128" cy="128" r="78" fill="url(#g)" opacity=".55"/><path d="M128 194 C60 150 54 96 88 80 C110 70 124 88 128 98 C132 88 146 70 168 80 C202 96 196 150 128 194 Z" fill="url(#m)"/>
<path d="M120 112 h16 v-16 h12 v16 h16 v12 h-16 v16 h-12 v-16 h-16z" fill="#fff8" transform="translate(-12 0)"/>`,
  spark: `<path d="M144 20 L70 140 H122 L100 236 L188 104 H136 Z" fill="url(#m)" stroke="#fff6" stroke-width="3"/>
<circle cx="128" cy="128" r="96" fill="none" stroke="url(#g)" stroke-width="4" stroke-dasharray="6 14"/>`,
  shatter: `<path d="M128 30 L180 80 L220 128 L170 180 L128 226 L80 176 L36 128 L84 78 Z" fill="url(#m)"/>
<path d="M128 30 L120 110 L36 128 M120 110 L170 180 M120 110 L220 128 M120 110 L128 226 M120 110 L84 78" stroke="#fffb" stroke-width="3" fill="none"/>
<path d="M210 40 l20 -10 -6 22z M40 210 l-10 22 22 -6z" fill="url(#h)"/>`,
  ward: `<path d="M128 26 L204 56 V122 C204 172 170 206 128 228 C86 206 52 172 52 122 V56 Z" fill="url(#m)" stroke="#ffd56b" stroke-width="5"/>
<path d="M128 60 L176 80 V124 C176 156 156 178 128 192 C100 178 80 156 80 124 V80 Z" fill="url(#h)" opacity=".7"/>
<circle cx="128" cy="124" r="16" fill="url(#g)"/>`,
  boost: `<path d="M128 24 L196 112 H156 V224 H100 V112 H60 Z" fill="url(#m)" stroke="#fff6" stroke-width="3"/>
<path d="M40 200 l20 -40 M216 200 l-20 -40 M60 60 l14 20 M196 60 l-14 20" stroke="url(#g)" stroke-width="6" stroke-linecap="round"/>`,
  draw: `<g transform="rotate(-16 128 140)"><rect x="70" y="56" width="90" height="128" rx="10" fill="url(#h)" stroke="#ffd56b" stroke-width="3"/></g>
<g transform="rotate(4 128 140)"><rect x="86" y="50" width="90" height="128" rx="10" fill="url(#m)" stroke="#ffd56b" stroke-width="3"/></g>
<circle cx="131" cy="114" r="22" fill="url(#g)"/><path d="M131 96 l6 14 14 4 -14 4 -6 14 -6 -14 -14 -4 14 -4z" fill="#fff"/>`,
};

export function createDuelCardArt(kind: string, color: string): string {
  const c = safeColor(color);
  const body = SUBJECTS[kind] ?? SUBJECTS.spark;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<defs>
<radialGradient id="bg" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="${shade(c, 0.18)}"/><stop offset=".55" stop-color="${shade(c, -0.28)}"/><stop offset="1" stop-color="#0b0a24"/></radialGradient>
<linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(c, 0.32)}"/><stop offset="1" stop-color="${shade(c, -0.22)}"/></linearGradient>
<linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e2a4"/><stop offset="1" stop-color="${shade(c, -0.05)}"/></linearGradient>
<radialGradient id="g"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#7ff3e6"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="256" height="256" fill="url(#bg)"/>
<g opacity=".35" fill="#fff"><circle cx="30" cy="40" r="1.6"/><circle cx="220" cy="30" r="1.2"/><circle cx="200" cy="210" r="1.8"/><circle cx="46" cy="220" r="1.2"/><circle cx="140" cy="20" r="1"/></g>
<ellipse cx="128" cy="232" rx="96" ry="14" fill="#000" opacity=".3"/>
${body}
</svg>`;
}

export function duelArtDataUri(kind: string, color: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createDuelCardArt(kind, color))}`;
}

export const DUEL_ART_KINDS = Object.keys(SUBJECTS);
