/* Madhorse template tutorials: deterministic canvas renderer.
   TutorialEngine.draw(ctx, slug, t) paints a 1920x1080 frame for time t (seconds).
   Shared by the live preview (React) and the FFmpeg exporter (public/render). */
(function () {
  const W = 1920, H = 1080;
  const C = {
    bg: '#0e0f11', panel: '#16171a', raised: '#1e1f23', line: '#34353a', ink: '#eeece9',
    muted: '#aaa6a3', dim: '#6f6b6a', red: '#d8473a', redSoft: '#f1775b', gold: '#e2b45c',
    teal: '#5fb7b0', blue: '#5578ba', green: '#7fa45a', paper: '#e9e3d6',
  };
  const DISPLAY = '"Barlow Condensed", "DejaVu Sans Condensed", "DejaVu Sans", sans-serif';
  const MONO = '"JetBrains Mono", "DejaVu Sans Mono", monospace';

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const eo = x => 1 - Math.pow(1 - x, 3);
  const eio = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const back = x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------- primitives ----------
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function box(ctx, x, y, w, h, r, fill, stroke, lw = 2) {
    rr(ctx, x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function text(ctx, s, x, y, o = {}) {
    ctx.save();
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    ctx.font = `${o.weight || 600} ${o.size || 28}px ${o.mono ? MONO : DISPLAY}`;
    ctx.fillStyle = o.color || C.ink; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
    if (o.track) { try { ctx.letterSpacing = o.track + 'px'; } catch (e) { /* older canvas */ } }
    ctx.fillText(s, x, y); ctx.restore();
  }
  function wrap(ctx, s, x, y, maxW, lh, o = {}) {
    ctx.save(); ctx.font = `${o.weight || 500} ${o.size || 28}px ${o.mono ? MONO : DISPLAY}`;
    const words = s.split(' '); let line = ''; let yy = y; const lines = [];
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line); ctx.restore();
    lines.forEach((l, i) => text(ctx, l, x, yy + i * lh, o)); return lines.length;
  }
  function key(ctx, label, x, y, w, h, on, k = 1) {
    ctx.save(); const dy = on ? 6 : 0;
    box(ctx, x, y + 8, w, h, 12, '#08090a');
    box(ctx, x, y + dy, w, h, 12, on ? C.red : C.raised, on ? C.redSoft : C.line, 2);
    text(ctx, label, x + w / 2, y + dy + h / 2 + 2, { size: label.length > 5 ? 22 : label.length > 2 ? 28 : 40, weight: 700, align: 'center', base: 'middle', color: on ? '#fff7f2' : C.ink, mono: label.length <= 2 });
    ctx.restore();
  }
  function cursor(ctx, x, y, click) {
    ctx.save(); ctx.translate(x, y);
    if (click > 0 && click < 1) { ctx.strokeStyle = C.redSoft; ctx.globalAlpha = 1 - click; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 14 + click * 46, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    const s = click > 0 && click < .3 ? .88 : 1; ctx.scale(s * 1.5, s * 1.5);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.lineTo(7, 20); ctx.lineTo(12, 31); ctx.lineTo(17, 29); ctx.lineTo(12, 18); ctx.lineTo(21, 18); ctx.closePath();
    ctx.fillStyle = C.ink; ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
  // cursor path helper: list of [time, x, y]; clicks: times
  function cursorAt(lt, path, clicks) {
    let x = path[0][1], y = path[0][2];
    for (let i = 1; i < path.length; i++) { const [t1, x1, y1] = path[i]; const [t0, x0, y0] = path[i - 1]; if (lt >= t0) { const k = eio(seg(lt, t0, t1)); x = lerp(x0, x1, k); y = lerp(y0, y1, k); } }
    let c = 0; for (const ct of clicks || []) if (lt >= ct && lt < ct + .6) c = (lt - ct) / .6;
    return { x, y, c };
  }

  // ---------- template worlds ----------
  function figure(ctx, x, y, s, color, pose = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 4, 26, 7, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, -96); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(-13, 0); ctx.moveTo(0, -46); ctx.lineTo(13, 0); ctx.stroke();
    const p = pose; ctx.beginPath(); ctx.moveTo(0, -86); ctx.lineTo(20 + p * 34, -78 - p * 6); ctx.moveTo(0, -86); ctx.lineTo(16, -66); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -112, 15, 0, 7); ctx.fill(); ctx.restore();
  }
  function bar(ctx, x, y, w, k, col, label) {
    box(ctx, x, y, w, 16, 4, '#0a0a0b', C.line, 1.5); box(ctx, x + 2, y + 2, Math.max(0, (w - 4) * k), 12, 3, col);
    if (label) text(ctx, label, x, y - 8, { size: 18, mono: true, color: C.muted, weight: 500 });
  }
  function hudChip(ctx, x, y, s) { ctx.save(); ctx.font = `600 18px ${MONO}`; const w = ctx.measureText(s).width + 24; ctx.restore(); box(ctx, x, y, w, 32, 6, 'rgba(10,10,12,.8)', C.line, 1); text(ctx, s, x + 12, y + 22, { size: 18, mono: true, color: C.ink, weight: 600 }); return w; }

  const worlds = {
    '2d-fighting'(ctx, r, t, a) {
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#22252f'); g.addColorStop(1, '#13151b'); ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = 'rgba(217,74,67,.25)'; ctx.beginPath(); ctx.arc(r.x + r.w * .12, r.y + r.h * .25, r.h * .2, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(82,125,225,.22)'; ctx.beginPath(); ctx.arc(r.x + r.w * .88, r.y + r.h * .25, r.h * .2, 0, 7); ctx.fill();
      const fy = r.y + r.h * .78; box(ctx, r.x + r.w * .05, fy, r.w * .9, r.h * .1, 10, '#292d38'); ctx.fillStyle = '#9a4546'; ctx.fillRect(r.x + r.w * .07, fy + 6, r.w * .86, 5);
      const px = r.x + r.w * (.36 + (a.move || 0) * .08), rx = r.x + r.w * .64; const s = r.h / 420;
      figure(ctx, px, fy, s, '#c75a62', a.attack || 0); ctx.save(); ctx.translate(rx * 2, 0); ctx.scale(-1, 1); figure(ctx, rx, fy, s, C.blue, 0); ctx.restore();
      if (a.block) { ctx.strokeStyle = C.gold; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(px + 20 * s, fy - 80 * s, 50 * s, -1.2, 1.2); ctx.stroke(); }
      if (a.attack > .5) { ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(px + 60 * s, fy - 85 * s, 14 * s * a.attack, 0, 7); ctx.fill(); }
      bar(ctx, r.x + 30, r.y + 40, r.w * .38, 1, C.red, 'PLAYER FIGHTER'); bar(ctx, r.x + r.w * .6 - 30, r.y + 40, r.w * .38, a.rivalHp == null ? 1 : a.rivalHp, C.blue, 'TRAINING RIVAL');
    },
    rts(ctx, r, t, a) {
      ctx.fillStyle = '#5a7547'; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, u = r.h / 10;
      ctx.strokeStyle = '#a68a63'; ctx.lineWidth = u * .55; ctx.beginPath(); ctx.moveTo(r.x, cy + u * .3); ctx.lineTo(r.x + r.w, cy - u * .3); ctx.moveTo(cx, r.y); ctx.lineTo(cx + u * .4, r.y + r.h); ctx.stroke();
      for (let i = 0; i < 3; i++) { const fx = cx - u * 4.4 + i * u * .9; for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#839b4a' : '#806346'; ctx.fillRect(fx, cy + u * 1.2 + k * u * .45, u * .7, u * .35); } }
      box(ctx, cx - u * 1.1, cy - u * 1.1, u * 2.2, u * 2.2, 6, '#8d887c', '#4b4840', 3); ctx.fillStyle = '#a25a45'; ctx.beginPath(); ctx.moveTo(cx - u * 1.2, cy - u * .2); ctx.lineTo(cx, cy - u * 1.5); ctx.lineTo(cx + u * 1.2, cy - u * .2); ctx.fill();
      text(ctx, 'KEEP', cx, cy + u * .7, { size: u * .38, align: 'center', weight: 700, color: '#2a2622' });
      [[2.6, -2.2], [3.6, 1.6], [-2.9, -2.4], [-3.8, -.4]].forEach(([dx, dy]) => { box(ctx, cx + dx * u - u * .5, cy + dy * u - u * .4, u, u * .8, 4, '#d6c8a8'); ctx.fillStyle = '#9c4d3c'; ctx.fillRect(cx + dx * u - u * .55, cy + dy * u - u * .55, u * 1.1, u * .3); });
      for (let i = 0; i < 26; i++) { const x = r.x + ((i * 137) % r.w), y = r.y + ((i * 89) % (r.h * .22)) + (i % 2 ? r.h * .78 : 0); ctx.fillStyle = i % 3 ? '#3e704a' : '#668b51'; ctx.beginPath(); ctx.arc(x, y, u * .38, 0, 7); ctx.fill(); }
      const bx = cx + u * 5.5, by = cy - u * 2.4; ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(bx, by, u * .5 + Math.sin(t * 4) * 4, 0, 7); ctx.stroke(); text(ctx, 'MARKET GATE', bx, by - u * .8, { size: u * .32, align: 'center', weight: 700, color: C.gold });
      [[-4.6, 2.9, '#c4a24a'], [4.4, 2.2, '#c4a24a']].forEach(([dx, dy, c]) => { ctx.fillStyle = c; ctx.save(); ctx.translate(cx + dx * u, cy + dy * u); ctx.rotate(.78); ctx.fillRect(-u * .25, -u * .25, u * .5, u * .5); ctx.restore(); });
      const pk = a.move || 0; const plx = cx - u * 1.8 + pk * u * 1.4, ply = cy + u * 2.6; const rally = a.rally || 0;
      for (let i = 0; i < 4; i++) { const ox = lerp(plx - u * .6 - i * u * .45, bx - u * .4 + i * u * .3, rally), oy = lerp(ply + u * .4, by + u * .5, rally); ctx.fillStyle = '#5578ba'; ctx.beginPath(); ctx.arc(ox, oy, u * .2, 0, 7); ctx.fill(); }
      ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(plx, ply, u * .3, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
      if (a.build) { box(ctx, plx + u * .5, ply - u * .9, u * .6 * a.build, u * .6 * a.build, 3, '#b58e52', '#5c4126'); }
      ctx.restore();
      hudChip(ctx, r.x + 20, r.y + 20, `WOOD ${a.wood ?? 10}  PLANKS ${a.planks ?? 3}`);
    },
    fps(ctx, r, t, a) {
      const cx = r.x + r.w / 2 + (a.look || 0) * r.w * .06, cy = r.y + r.h * .48;
      ctx.fillStyle = '#2a2d31'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#3a3c3f'; ctx.fillRect(r.x, cy, r.w, r.y + r.h - cy);
      ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      ctx.strokeStyle = '#55585d'; ctx.lineWidth = 2; const vx = cx, vy = cy;
      for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx + i * r.w * .25, r.y + r.h); ctx.stroke(); }
      for (let k = 1; k < 7; k++) { const y = vy + (r.y + r.h - vy) * Math.pow(k / 7, 2); ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke(); }
      box(ctx, vx - r.w * .28, vy - r.h * .3, r.w * .56, r.h * .3, 2, '#34373b', '#4b4e53');
      [[-.3, .08, 60], [.32, .1, 64], [-.12, -.02, 30], [.14, -.03, 30], [-.45, .25, 90], [.42, .3, 96]].forEach(([dx, dy, s], i) => {
        const hit = (a.hits || 0) > i; const x = vx + dx * r.w, y = vy + dy * r.h; ctx.globalAlpha = hit ? .25 : 1;
        ctx.fillStyle = '#f1e7d4'; ctx.beginPath(); ctx.arc(x, y - s * .2, s * .45, 0, 7); ctx.fill(); ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(x, y - s * .2, s * .28, 0, 7); ctx.fill(); ctx.fillStyle = '#f1e7d4'; ctx.beginPath(); ctx.arc(x, y - s * .2, s * .1, 0, 7); ctx.fill(); ctx.fillStyle = '#6a6d72'; ctx.fillRect(x - 3, y + s * .25, 6, s * .5); ctx.globalAlpha = 1;
      });
      box(ctx, r.x + r.w * .1, cy + r.h * .1, r.w * .12, r.h * .16, 4, '#4a4d45'); box(ctx, r.x + r.w * .78, cy + r.h * .12, r.w * .1, r.h * .14, 4, '#4a4d45');
      ctx.restore();
      const gx = r.x + r.w * .72, gy = r.y + r.h * (.86 + (a.crouch ? .04 : 0)) - (a.jump || 0) * 30 + (a.recoil || 0) * 18;
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(-.18); box(ctx, -40, -30, 280, 60, 10, '#1d1f22', '#55585d'); box(ctx, 160, -18, 140, 26, 6, '#2b2e32'); box(ctx, 20, 20, 50, 90, 8, '#26282b'); ctx.restore();
      if (a.flash) { ctx.fillStyle = `rgba(242,180,92,${a.flash})`; ctx.beginPath(); ctx.arc(gx - 10, gy - 70, 34, 0, 7); ctx.fill(); }
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; const ch = r.x + r.w / 2, cv = r.y + r.h / 2; ctx.beginPath(); ctx.moveTo(ch - 18, cv); ctx.lineTo(ch - 6, cv); ctx.moveTo(ch + 6, cv); ctx.lineTo(ch + 18, cv); ctx.moveTo(ch, cv - 18); ctx.lineTo(ch, cv - 6); ctx.moveTo(ch, cv + 6); ctx.lineTo(ch, cv + 18); ctx.stroke();
      hudChip(ctx, r.x + r.w - 220, r.y + r.h - 56, `AMMO ${a.ammo ?? 30} / 90`); hudChip(ctx, r.x + 20, r.y + 20, `TARGETS ${a.hits || 0} / 6`); bar(ctx, r.x + 20, r.y + r.h - 40, 240, 1, C.green);
    },
    'third-person-shooter'(ctx, r, t, a) {
      ctx.fillStyle = '#2b2e33'; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      const hy = r.y + r.h * .42; ctx.fillStyle = '#3b3e43'; ctx.fillRect(r.x, hy, r.w, r.h);
      ctx.strokeStyle = '#50545a'; for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(r.x + r.w / 2, hy); ctx.lineTo(r.x + r.w / 2 + i * r.w * .2, r.y + r.h); ctx.stroke(); }
      [[.2, .55, .16], [.7, .5, .12], [.48, .47, .08]].forEach(([x, y, w]) => box(ctx, r.x + r.w * x, r.y + r.h * y, r.w * w, r.h * .1, 4, '#5a5e55', '#2e302b'));
      [[.28, .5], [.6, .47], [.82, .55]].forEach(([x, y], i) => { const down = (a.hits || 0) > i; ctx.globalAlpha = down ? .3 : 1; figure(ctx, r.x + r.w * x + Math.sin(t * 1.4 + i) * 20, r.y + r.h * y, r.h / 900, '#7c8aa0'); ctx.globalAlpha = 1; });
      const sx = r.x + r.w * (.36 + (a.move || 0) * .05), sy = r.y + r.h * (.98 + (a.crouch ? .05 : 0)) - (a.jump || 0) * 40;
      figure(ctx, sx, sy, r.h / 300, '#b8574c', .6);
      if (a.flash) { ctx.fillStyle = `rgba(242,180,92,${a.flash})`; ctx.beginPath(); ctx.arc(sx + r.h * .22, sy - r.h * .27, 22, 0, 7); ctx.fill(); }
      ctx.restore();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x + r.w * .55, r.y + r.h * .45, 12, 0, 7); ctx.stroke();
      hudChip(ctx, r.x + r.w - 220, r.y + r.h - 56, `AMMO ${a.ammo ?? 30} / 90`); bar(ctx, r.x + 20, r.y + r.h - 40, 240, 1, C.green);
    },
    mmorpg(ctx, r, t, a) {
      ctx.fillStyle = '#62804e'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      const u = r.h / 10, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      ctx.strokeStyle = '#b29a6e'; ctx.lineWidth = u * .7; ctx.beginPath(); ctx.moveTo(r.x, cy + u); ctx.quadraticCurveTo(cx, cy - u, r.x + r.w, cy + u * .5); ctx.stroke();
      [[-4, -2.5], [-1.6, -3], [3.2, -2.6], [5, 2.6]].forEach(([dx, dy]) => { box(ctx, cx + dx * u - u * .8, cy + dy * u - u * .6, u * 1.6, u * 1.2, 4, '#d9cfb4'); ctx.fillStyle = '#7b3e3a'; ctx.beginPath(); ctx.moveTo(cx + dx * u - u, cy + dy * u - u * .5); ctx.lineTo(cx + dx * u, cy + dy * u - u * 1.3); ctx.lineTo(cx + dx * u + u, cy + dy * u - u * .5); ctx.fill(); });
      for (let i = 0; i < 18; i++) { ctx.fillStyle = i % 2 ? '#3e6a46' : '#4f7d4c'; ctx.beginPath(); ctx.arc(r.x + ((i * 211) % r.w), r.y + r.h * .85 + ((i * 37) % (r.h * .15)), u * .45, 0, 7); ctx.fill(); }
      const nx = cx + u * 1.6, ny = cy - u * .6; figure(ctx, nx, ny, r.h / 900, C.gold); text(ctx, '!', nx, ny - u * 1.55, { size: u * .8, weight: 800, color: C.gold, align: 'center' });
      [[-5, 2.8], [-3.6, 3.3]].forEach(([dx, dy]) => { ctx.fillStyle = '#9fd0d4'; ctx.save(); ctx.translate(cx + dx * u, cy + dy * u); ctx.rotate(.78); ctx.fillRect(-u * .22, -u * .22, u * .44, u * .44); ctx.restore(); });
      const hx = cx - u * 2 + (a.move || 0) * u * 1.6, hy = cy + u * 1.4; figure(ctx, hx, hy, r.h / 700, '#c0574a', a.attack || 0);
      if (a.spell) { ctx.strokeStyle = `rgba(160,140,255,${1 - a.spell})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(hx + u * 1.6 * a.spell + u * .4, hy - u * 1.2, u * .3 + a.spell * u * .3, 0, 7); ctx.stroke(); }
      if (a.heal) { ctx.strokeStyle = `rgba(127,200,120,${1 - a.heal})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(hx, hy - u * .8, u * (.6 + a.heal), 0, 7); ctx.stroke(); }
      ctx.restore(); bar(ctx, r.x + 20, r.y + r.h - 40, 220, a.hp ?? .8, C.green, 'HEALTH'); bar(ctx, r.x + 260, r.y + r.h - 40, 180, a.mana ?? 1, '#8c7be0', 'MANA');
      hudChip(ctx, r.x + r.w - 240, r.y + 20, a.fp ? 'VIEW · FIRST-PERSON' : 'VIEW · THIRD-PERSON');
    },
    '2d-rpg'(ctx, r, t, a) {
      const ts = Math.floor(r.h / 11), cols = Math.ceil(r.w / ts), rows = Math.ceil(r.h / ts);
      ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        let c = (i + j) % 2 ? '#78c06a' : '#6fb862'; if (j === 6 || i === 9) c = '#e0c98c'; if (i > cols - 6 && j < 4) c = (i + j) % 2 ? '#2f8a4c' : '#3a9a57'; if (j === 0 || i === 0) c = '#2d6b3b';
        ctx.fillStyle = c; ctx.fillRect(r.x + i * ts, r.y + j * ts, ts, ts);
        if (i > cols - 6 && j < 4 && j > 0) { ctx.fillStyle = '#1e6b38'; ctx.fillRect(r.x + i * ts + ts * .2, r.y + j * ts + ts * .3, ts * .15, ts * .5); ctx.fillRect(r.x + i * ts + ts * .6, r.y + j * ts + ts * .2, ts * .15, ts * .6); }
      }
      [[3, 2], [13, 7], [4, 8]].forEach(([i, j], k) => { ctx.fillStyle = k === 1 ? '#c84b4b' : '#4b6cc8'; ctx.fillRect(r.x + i * ts, r.y + j * ts, ts * 3, ts * 1); ctx.fillStyle = '#f2ead2'; ctx.fillRect(r.x + i * ts, r.y + (j + 1) * ts, ts * 3, ts * 1.6); ctx.fillStyle = '#6a4630'; ctx.fillRect(r.x + (i + 1.2) * ts, r.y + (j + 1.8) * ts, ts * .6, ts * .8); });
      const sprite = (gx, gy, col) => { const x = r.x + gx * ts, y = r.y + gy * ts; ctx.fillStyle = '#20202a'; ctx.fillRect(x + ts * .2, y + ts * .05, ts * .6, ts * .9); ctx.fillStyle = col; ctx.fillRect(x + ts * .28, y + ts * .4, ts * .44, ts * .45); ctx.fillStyle = '#f5d2b0'; ctx.fillRect(x + ts * .3, y + ts * .12, ts * .4, ts * .3); };
      sprite(10, 5, '#d8a23a'); text(ctx, '!', r.x + 10.5 * ts, r.y + 4.8 * ts, { size: ts * .8, weight: 800, align: 'center', color: '#fff' });
      sprite(6, 7, '#5fa0d8');
      const step = a.step || 0; sprite(8 + step, 6 - (a.up || 0), '#d84a4a');
      ctx.restore();
      if (a.battle) {
        ctx.save(); ctx.globalAlpha = a.battle; box(ctx, r.x + r.w * .08, r.y + r.h * .1, r.w * .84, r.h * .8, 10, '#f4efdf', '#2a2a2a', 6);
        text(ctx, 'WILD MOSSKIT', r.x + r.w * .55, r.y + r.h * .22, { size: 30, weight: 800, color: '#22222a' }); bar(ctx, r.x + r.w * .55, r.y + r.h * .26, r.w * .3, a.foeHp ?? 1, '#4aa65a');
        ctx.fillStyle = '#5fae6a'; ctx.beginPath(); ctx.arc(r.x + r.w * .7, r.y + r.h * .45, r.h * .1, 0, 7); ctx.fill();
        ['1  ATTACK', '2  CAPTURE', '3  RUN'].forEach((s, i) => { box(ctx, r.x + r.w * (.14 + i * .25), r.y + r.h * .68, r.w * .22, r.h * .14, 8, (a.pick === i + 1) ? C.red : '#e3dccb', '#2a2a2a', 3); text(ctx, s, r.x + r.w * (.25 + i * .25), r.y + r.h * .77, { size: 30, weight: 800, align: 'center', color: (a.pick === i + 1) ? '#fff' : '#22222a' }); });
        ctx.restore();
      }
    },
    'cart-racer'(ctx, r, t, a) {
      ctx.fillStyle = '#bfe3d0'; ctx.fillRect(r.x, r.y, r.w, r.h);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rx = r.w * .38, ry = r.h * .33;
      ctx.strokeStyle = '#f3c6d8'; ctx.lineWidth = r.h * .17; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#8c8aa6'; ctx.lineWidth = r.h * .13; ctx.stroke(); ctx.setLineDash([18, 18]); ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
      const gates = [['FINISH', Math.PI / 2], ['NORTH', 0], ['WEST', -Math.PI / 2], ['SOUTH', Math.PI]];
      gates.forEach(([n, ang], i) => { const gx = cx + Math.cos(ang) * rx, gy = cy + Math.sin(ang) * ry; const lit = (a.gate ?? -1) >= i && a.gate != null; ctx.strokeStyle = lit ? C.red : '#f2b84b'; ctx.lineWidth = 8; ctx.beginPath(); if (i % 2 === 0) { ctx.moveTo(gx - 70, gy); ctx.lineTo(gx + 70, gy); } else { ctx.moveTo(gx, gy - 70); ctx.lineTo(gx, gy + 70); } ctx.stroke(); text(ctx, n, gx + (i === 3 ? -90 : i === 1 ? 90 : 0), gy + (i === 0 ? 60 : i === 2 ? -52 : 8), { size: 26, weight: 800, align: 'center', color: '#2d2b3a' }); });
      const p = a.progress ?? 0, ang = Math.PI / 2 - p * Math.PI * 2 * (a.dir ?? 1); const kx = cx + Math.cos(ang) * rx, ky = cy + Math.sin(ang) * ry;
      ctx.save(); ctx.translate(kx, ky); ctx.rotate(ang - Math.PI / 2 * (a.dir ?? 1) + (a.steer || 0) * .3); box(ctx, -22, -32, 44, 64, 10, C.red, '#5a1d18', 3); box(ctx, -14, -12, 28, 20, 5, '#f3eadb'); ctx.restore();
      hudChip(ctx, r.x + 20, r.y + 20, `LAP ${a.lap ?? 1} / 3`); hudChip(ctx, r.x + 170, r.y + 20, `GATE ${a.gateLabel || '—'}`); hudChip(ctx, r.x + r.w - 260, r.y + 20, `BEST ${a.best || '--:--.--'}`);
    },
    'card-duel'(ctx, r, t, a) {
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#152446'); g.addColorStop(1, '#0d1730'); ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
      const lw = r.w * .14, lh = r.h * .22, gap = r.w * .04, x0 = r.x + r.w / 2 - lw * 1.5 - gap;
      for (let i = 0; i < 3; i++) { box(ctx, x0 + i * (lw + gap), r.y + r.h * .17, lw, lh, 8, 'rgba(255,255,255,.03)', '#3c5288', 2); box(ctx, x0 + i * (lw + gap), r.y + r.h * .45, lw, lh, 8, 'rgba(255,255,255,.03)', '#3c5288', 2); }
      const card = (x, y, w, h, title, atk, col, lift) => { box(ctx, x, y - lift, w, h, 8, col, '#2b1d10', 3); box(ctx, x + w * .1, y - lift + h * .14, w * .8, h * .44, 4, '#1b2a50'); text(ctx, title, x + w / 2, y - lift + h * .1, { size: Math.max(14, w * .11), weight: 800, align: 'center', color: '#20160b' }); if (atk) text(ctx, atk, x + w / 2, y - lift + h * .78, { size: Math.max(14, w * .1), mono: true, align: 'center', color: '#20160b' }); };
      card(x0 + (lw + gap), r.y + r.h * .17 + lh * .08, lw, lh * .84, 'NOVA UNIT', '1400/1000', '#7aa0d8', 0);
      if (a.summoned) card(x0, r.y + r.h * .45 + lh * .08, lw, lh * .84, 'EMBER KIT', '1600/1100', '#c69350', 0);
      else card(x0 + lw + gap, r.y + r.h * .45 + lh * .08, lw, lh * .84, 'SPROUT', '1000/900', '#c69350', 0);
      const hand = 4 - (a.summoned ? 1 : 0); for (let i = 0; i < hand; i++) { const sel = a.select && i === 0; card(r.x + r.w / 2 - hand * r.w * .055 + i * r.w * .11, r.y + r.h * .74, r.w * .1, r.h * .22, ['EMBER KIT', 'MEND', 'WARD', 'TIDAL'][i + (a.summoned ? 1 : 0)] || 'CARD', '', '#d9b26f', sel ? 18 : 0); }
      if (a.attack) { ctx.strokeStyle = C.red; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0 + lw / 2, r.y + r.h * .48); ctx.lineTo(lerp(x0 + lw / 2, x0 + lw * 1.5 + gap, a.attack), lerp(r.y + r.h * .48, r.y + r.h * .3, a.attack)); ctx.stroke(); }
      text(ctx, `NOVA  LP ${a.rivalLp ?? 4000}`, r.x + 24, r.y + 44, { size: 28, weight: 700, mono: true, color: '#cfe0ff' });
      text(ctx, `YOU  LP 4000`, r.x + 24, r.y + r.h * .72, { size: 28, weight: 700, mono: true, color: C.gold });
      text(ctx, a.phase || 'MAIN PHASE', r.x + r.w - 24, r.y + 44, { size: 26, weight: 700, mono: true, align: 'right', color: C.ink });
    },
    basketball(ctx, r, t, a) {
      ctx.fillStyle = '#28303a'; ctx.fillRect(r.x, r.y, r.w, r.h);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, cw = r.w * .86, chh = r.h * .76;
      box(ctx, cx - cw / 2, cy - chh / 2, cw, chh, 6, '#c99a62', '#f4efe2', 4);
      ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy - chh / 2); ctx.lineTo(cx, cy + chh / 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, chh * .16, 0, 7); ctx.stroke();
      [[-1, C.red], [1, C.blue]].forEach(([s]) => { ctx.beginPath(); ctx.arc(cx + s * cw / 2, cy, chh * .42, s < 0 ? -1.57 : 1.57, s < 0 ? 1.57 : 4.71); ctx.stroke(); ctx.fillStyle = '#f2733c'; ctx.beginPath(); ctx.arc(cx + s * (cw / 2 - 40), cy, 16, 0, 7); ctx.fill(); });
      const mv = a.move || 0; const px = cx + cw * (.1 + mv * .12), py = cy + chh * .1;
      [[.0, -.25], [-.12, .28]].forEach(([dx, dy]) => { ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(cx + dx * cw, cy + dy * chh, 18, 0, 7); ctx.fill(); });
      [[.25, -.1], [.32, .2], [.18, .3]].forEach(([dx, dy], i) => { ctx.fillStyle = C.blue; ctx.beginPath(); ctx.arc(cx + dx * cw + Math.sin(t * 2 + i) * 8, cy + dy * chh, 18, 0, 7); ctx.fill(); });
      ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(px, py, 22, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
      const shot = a.shot || 0; const hx = cx + cw / 2 - 40; const bx = lerp(px + 20, hx, shot), by = lerp(py - 10, cy, shot) - Math.sin(shot * Math.PI) * chh * .35;
      ctx.fillStyle = '#e8732d'; ctx.beginPath(); ctx.arc(a.pass ? lerp(px + 20, cx, a.pass) : bx, a.pass ? lerp(py - 10, cy - chh * .25, a.pass) : by, 11, 0, 7); ctx.fill();
      if (a.charge != null) { bar(ctx, px - 60, py - 70, 120, a.charge, a.charge > .78 && a.charge < .9 ? C.green : C.gold); ctx.fillStyle = 'rgba(127,180,90,.6)'; ctx.fillRect(px - 60 + 120 * .78, py - 70, 120 * .12, 16); }
      hudChip(ctx, r.x + 20, r.y + 14, `METRO COMETS ${a.home ?? 0}  ·  HARBOR WAVES 0`); hudChip(ctx, r.x + r.w - 150, r.y + 14, a.clock || '3:00');
    },
    blank(ctx, r, t, a) {
      ctx.fillStyle = '#1b1d21'; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; for (let x = r.x; x < r.x + r.w; x += 48) { ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); } for (let y = r.y; y < r.y + r.h; y += 48) { ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke(); }
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2; ctx.strokeStyle = 'rgba(216,71,58,.5)'; ctx.beginPath(); ctx.moveTo(r.x, cy); ctx.lineTo(r.x + r.w, cy); ctx.stroke(); ctx.strokeStyle = 'rgba(95,183,176,.5)'; ctx.beginPath(); ctx.moveTo(cx, r.y); ctx.lineTo(cx, r.y + r.h); ctx.stroke();
      const k = a.cube || 0; if (k > 0) { const s = 90 * back(k), ox = (a.move || 0) * 160; ctx.save(); ctx.translate(cx + ox, cy); ctx.fillStyle = '#c75a4e'; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.fillStyle = '#e07e6d'; ctx.beginPath(); ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(-s / 4, -s * .8); ctx.lineTo(s * .75, -s * .8); ctx.lineTo(s / 2, -s / 2); ctx.fill(); ctx.fillStyle = '#9c3f36'; ctx.beginPath(); ctx.moveTo(s / 2, -s / 2); ctx.lineTo(s * .75, -s * .8); ctx.lineTo(s * .75, s * .2); ctx.lineTo(s / 2, s / 2); ctx.fill(); ctx.restore(); }
      if (!k) text(ctx, 'EMPTY SCENE', cx, cy - 30, { size: 34, weight: 700, color: C.dim, align: 'center', track: 6 });
    },
  };

  // ---------- guide data (facts from Studio starter + runtime source) ----------
  const G = (o) => o;
  const GUIDES = [
    G({ slug: '2d-fighting', num: '01', title: '2D/3D Fighting Game', kicker: 'FIGHTING STARTER', card: 'CREATE FIGHTING PROJECT', project: 'Crimson Dojo', create: 'Create fighting game',
      hierarchy: ['Fighting Stage Floor', 'Arena Backdrop', 'Arena Sky Background', 'Player Fighter', 'Training Rival'],
      controls: [
        { keys: ['A', 'D'], label: 'Move left and right', act: lt => ({ move: Math.sin(lt * 3) * .8 }) },
        { keys: ['F'], label: 'Light attack', act: lt => ({ attack: (lt * 2) % 1, rivalHp: .9 }) },
        { keys: ['G'], label: 'Heavy attack', act: lt => ({ attack: Math.min(1, lt), rivalHp: .74 }) },
        { keys: ['CTRL'], label: 'Block', act: () => ({ block: 1, rivalHp: .74 }) },
        { keys: ['SHIFT', 'C'], label: 'Run · Crouch', act: lt => ({ move: Math.min(1, lt * .7), rivalHp: .74 }) },
      ],
      goal: { title: 'Wear down the Training Rival', lines: ['Two editable fighters face off in a side-view arena.', 'Land attacks to drain the rival’s health bar.', 'Every Play Test starts the fight fresh.'], act: lt => ({ attack: (lt * 1.5) % 1, rivalHp: clamp(1 - lt * .14, .2) }) },
      edit: { pick: 'Player Fighter', how: 'Double-click Player Fighter', panel: 'Replace fighter · 2D / 3D', field: 'Character type', from: '3D character', to: '2D sprite', note: 'Import a sprite or FBX / GLB first via Hierarchy → Import asset. Combat and movement stay intact.' } }),
    G({ slug: 'rts', num: '02', title: 'Strategy World', kicker: 'RTS STARTER · SUNSTONE VALE', card: 'CREATE RTS PROJECT', project: 'Sunstone Frontier', create: 'Create RTS project',
      hierarchy: ['Central Keep', 'Terracotta Cottages', 'Crop Farms', 'Environment · Pine 1', 'Resource caches', 'Market Gate beacon', 'Allied squad'],
      controls: [
        { keys: ['W', 'A', 'S', 'D'], label: 'Move your commander', act: lt => ({ move: Math.sin(lt * 2) * .5 + .5 }) },
        { keys: ['G'], label: 'Gather a nearby resource cache', act: lt => ({ move: 1, wood: lt > .8 ? 14 : 10 }) },
        { keys: ['K'], label: 'Craft wood into planks', act: lt => ({ move: 1, wood: lt > .8 ? 12 : 14, planks: lt > .8 ? 4 : 3 }) },
        { keys: ['B'], label: 'Place a temporary construction block', act: lt => ({ move: 1, wood: 12, planks: 3, build: seg(lt, .3, .9) }) },
        { keys: ['T'], label: 'Send nearby allies to the Market Gate', act: lt => ({ move: 1, wood: 12, planks: 3, build: 1, rally: eio(seg(lt, .2, 1.8)) }) },
      ],
      goal: { title: 'Rally your squad to the Market Gate', lines: ['Gather, craft, and build around the keep.', 'Press T to order nearby allied units to the beacon.', 'A playable prototype: movement is straight-line, no pathfinding.'], act: lt => ({ move: 1, rally: eio(seg(lt, .5, 3)) }) },
      edit: { pick: 'Central Keep', how: 'Select Central Keep in Hierarchy', panel: 'Health & Damage', field: 'Max health', from: '100', to: '250', note: 'Terrain, buildings, roads, trees, units, textures and HUD are all editable scene pieces.' } }),
    G({ slug: 'fps', num: '03', title: 'FPS · Ironlight Facility', kicker: 'FPS STARTER', card: 'CREATE FPS GAME', project: 'Ironlight Range', create: 'Create FPS game',
      hierarchy: ['Facility Floor', 'Facility Walls', 'Cover blocks', 'Modular Carbine', 'Range Target 1–6', 'Lights'],
      controls: [
        { keys: ['CLICK'], label: 'Click the viewport to capture the mouse', act: lt => ({ look: Math.sin(lt * 2) * .6 }) },
        { keys: ['W', 'A', 'S', 'D'], label: 'Move and strafe · mouse to look', act: lt => ({ look: Math.sin(lt * 3) }) },
        { keys: ['LMB', 'J'], label: 'Shoot', act: lt => ({ hits: lt > .9 ? 1 : 0, flash: ((lt * 4) % 1) < .3 ? .9 : 0, recoil: ((lt * 4) % 1) < .3 ? 1 : 0, ammo: 30 - Math.floor(lt * 4) }) },
        { keys: ['R'], label: 'Reload from reserve', act: lt => ({ hits: 1, ammo: lt > .6 ? 30 : 22 }) },
        { keys: ['SHIFT', 'C', 'SPACE'], label: 'Sprint · Crouch · Jump', act: lt => ({ hits: 1, crouch: lt > .7 && lt < 1.3, jump: lt > 1.3 ? Math.sin(seg(lt, 1.3, 1.9) * Math.PI) : 0 }) },
      ],
      goal: { title: 'Clear all six range targets', lines: ['Six targets stand around the facility.', 'Hit each one to clear the range.', 'Press Esc to release the mouse or stop the test.'], act: lt => ({ hits: Math.min(6, Math.floor(lt * 1.6)), flash: ((lt * 1.6) % 1) < .2 ? .8 : 0, look: Math.sin(lt) * .5, ammo: 30 - Math.min(6, Math.floor(lt * 1.6)) }) },
      edit: { pick: 'Range Target 1', how: 'Select a range target in Hierarchy', panel: 'Health & Damage', field: 'Max health', from: '100', to: '160', note: 'Floor, walls, cover, textures, lighting, weapon and HUD are editable too.' } }),
    G({ slug: 'third-person-shooter', num: '04', title: 'Third-Person Shooter', kicker: 'IRONLIGHT OPS', card: 'CREATE THIRD-PERSON GAME', project: 'Ironlight Ops', create: 'Create third-person shooter',
      hierarchy: ['Operative (Player)', 'Shoulder Camera', 'Cover walls', 'Target operatives', 'Facility floor'],
      controls: [
        { keys: ['CLICK'], label: 'Click the viewport to capture the mouse', act: () => ({}) },
        { keys: ['W', 'A', 'S', 'D'], label: 'Move and strafe · mouse to look', act: lt => ({ move: Math.sin(lt * 3) }) },
        { keys: ['LMB', 'J'], label: 'Shoot', act: lt => ({ hits: lt > 1 ? 1 : 0, flash: ((lt * 4) % 1) < .3 ? .9 : 0, ammo: 30 - Math.floor(lt * 4) }) },
        { keys: ['R'], label: 'Reload', act: lt => ({ hits: 1, ammo: lt > .6 ? 30 : 22 }) },
        { keys: ['SHIFT', 'C', 'SPACE'], label: 'Sprint · Crouch · Jump', act: lt => ({ hits: 1, crouch: lt > .7 && lt < 1.3, jump: lt > 1.3 ? Math.sin(seg(lt, 1.3, 1.9) * Math.PI) : 0 }) },
      ],
      goal: { title: 'Fight from cover', lines: ['An over-the-shoulder camera follows your operative.', 'Use cover, then drop the moving target operatives.', 'Esc releases the mouse or stops the test.'], act: lt => ({ hits: Math.min(3, Math.floor(lt * .9)), flash: ((lt * .9) % 1) < .2 ? .8 : 0, move: Math.sin(lt) * .5 }) },
      edit: { pick: 'Target operative', how: 'Select a target operative', panel: 'Health & Damage', field: 'Max health', from: '100', to: '140', note: 'The operative, cover, textures and HUD are all editable.' } }),
    G({ slug: 'mmorpg', num: '05', title: 'MMORPG · Sunstone Vale', kicker: 'MMORPG ADVENTURE', card: 'CREATE MMORPG', project: 'Vale of Embers', create: 'Create MMORPG',
      hierarchy: ['Hero (Player)', 'Quest guide', 'Villagers', 'Settlement houses', 'Resource nodes', 'Multiplayer room'],
      controls: [
        { keys: ['W', 'A', 'S', 'D'], label: 'Move · Shift to run · C to crouch', act: lt => ({ move: Math.sin(lt * 2) * .5 + .5 }) },
        { keys: ['F', 'Q'], label: 'Fight · cast a spell (uses mana)', act: lt => ({ move: 1, attack: lt < 1 ? (lt * 2) % 1 : 0, spell: lt > 1 ? seg(lt, 1, 1.8) : 0, mana: lt > 1 ? .7 : 1 }) },
        { keys: ['H'], label: 'Heal yourself', act: lt => ({ move: 1, heal: seg(lt, .2, 1.2), hp: lerp(.6, .95, seg(lt, .2, 1.2)), mana: .7 }) },
        { keys: ['G', 'K', 'E'], label: 'Gather · craft · interact', act: lt => ({ move: 1 }) },
        { keys: ['U', 'V'], label: 'Recruit a companion · switch view', act: lt => ({ move: 1, fp: lt > 1 }) },
      ],
      goal: { title: 'Meet the quest guide', lines: ['Walk to the villager marked with ! and press E.', 'Fight, gather and craft to complete quests.', 'Host or join a room in Multiplayer Tools (up to 32).'], act: lt => ({ move: clamp(lt / 3) * 2.1 }) },
      edit: { pick: 'Hero (Player)', how: 'Select the hero in Hierarchy', panel: 'Inventory', field: 'Starting wood', from: '10', to: '25', note: 'This is an editable multiplayer starter, not a persistent MMO service.' } }),
    G({ slug: '2d-rpg', num: '06', title: '2D RPG', kicker: 'MOSSLIGHT TRAIL', card: 'CREATE 2D RPG', project: 'Mosslight Trail', create: 'Create',
      hierarchy: ['Map backdrop', 'Player', 'Quest guide', 'Healing neighbor', 'Wild encounter grass', 'Starting companion'],
      controls: [
        { keys: ['CLICK'], label: 'Click the map to focus', act: () => ({}) },
        { keys: ['W', 'A', 'S', 'D'], label: 'Walk · arrow keys work too', act: lt => ({ step: Math.floor(lt * 2) % 3 }) },
        { keys: ['E', 'ENTER'], label: 'Talk to neighbors or heal', act: () => ({ step: 2 }) },
        { keys: ['1', '2', '3'], label: 'In battle: attack · capture · run', act: lt => ({ step: 2, battle: 1, pick: lt < .7 ? 1 : 2, foeHp: lt < .7 ? .7 : .45 }) },
      ],
      goal: { title: 'Catch a creature, then return', lines: ['Walk into the tall grass in the northeast.', 'Weaken a wild creature, then capture it with an orb.', 'Return to the quest guide to finish your first quest.'], act: lt => ({ step: Math.min(4, Math.floor(lt * 1.6)), up: Math.min(3, Math.floor(seg(lt, 2.5, 4) * 3)) }) },
      edit: { pick: 'Quest guide', how: 'Select the quest guide in Hierarchy', panel: '2D Creature RPG', field: 'What should they say?', from: 'Welcome to Mosslight Trail!', to: 'The grass is restless today.', note: 'Edit sprites in Sprite Renderer; map positions and creature stats live here too.' } }),
    G({ slug: 'cart-racer', num: '07', title: 'Cart Racer Stylized', kicker: 'CART RACER STARTER', card: 'CREATE CART RACER', project: 'Pastel Grand Prix', create: 'Create',
      hierarchy: ['Player kart', 'Oval track', 'Barriers', 'Gate 0 · North', 'Gate 1 · West', 'Gate 2 · South', 'Gate 3 · Finish'],
      controls: [
        { keys: ['W'], label: 'Accelerate · Up arrow works too', act: lt => ({ progress: lt * .04 }) },
        { keys: ['S'], label: 'Brake or reverse', act: lt => ({ progress: .08 - lt * .01 }) },
        { keys: ['A', 'D'], label: 'Steer left and right', act: lt => ({ progress: .06 + lt * .05, steer: Math.sin(lt * 4) }) },
        { keys: ['ESC'], label: 'Stop the test', act: () => ({ progress: .16 }) },
      ],
      goal: { title: 'Three laps, gates in order', lines: ['Drive through North → West → South → Finish.', 'Gates must be crossed forward, in order.', 'Lap, checkpoint, elapsed and best-lap times show in the HUD.'], act: lt => { const p = lt / 5.5; const g = Math.floor((p % 1) * 4); return { progress: p, gate: g, gateLabel: ['NORTH', 'WEST', 'SOUTH', 'FINISH'][g], lap: 1 + Math.floor(p), best: p > 1 ? '0:41.27' : null }; } },
      edit: { pick: 'Player kart', how: 'Select Player kart in Hierarchy', panel: 'Cart Racer', field: 'Laps to finish', from: '3', to: '5', note: 'Gate order, width and the kart, road, barriers and scenery are all editable.' } }),
    G({ slug: 'card-duel', num: '08', title: 'Card Duel', kicker: 'ASTRAL NEXUS', card: 'CREATE CARD DUEL', project: 'Astral Nexus Cup', create: 'Create',
      hierarchy: ['Duel Table · Rules & Background', 'Ember Kit (card)', 'Mend (spell)', 'Ward (trap)', 'Rival deck'],
      controls: [
        { keys: ['CLICK'], label: 'Select a card in your hand', act: () => ({ select: 1 }) },
        { keys: ['CLICK'], label: 'Summon · Play Spell · Set Ward', act: lt => ({ select: lt < .6, summoned: lt >= .6 }) },
        { keys: ['CLICK'], label: 'Battle: pick your monster, then an enemy zone', act: lt => ({ summoned: 1, phase: 'BATTLE PHASE', attack: seg(lt, .3, 1.2), rivalLp: lt > 1.2 ? 3800 : 4000 }) },
        { keys: ['CLICK'], label: 'End Turn lets Nova play', act: () => ({ summoned: 1, phase: 'NOVA’S TURN', rivalLp: 3800 }) },
      ],
      goal: { title: 'Bring Nova to zero life', lines: ['One normal summon per turn; levels 5–6 need one tribute, 7–8 need two.', 'No attacks on the first turn.', 'Win at zero life points or when Nova’s deck runs out.'], act: lt => ({ summoned: 1, phase: 'BATTLE PHASE', attack: (lt * .5) % 1, rivalLp: 4000 - Math.floor(lt * .5) * 200 }) },
      edit: { pick: 'Duel Table · Rules & Background', how: 'Select Duel Table in Hierarchy', panel: 'Card Duel', field: 'Table: starting life points', from: '4000', to: '6000', note: 'Rename cards, edit stats and copies, or replace art in Sprite Renderer.' } }),
    G({ slug: 'basketball', num: '09', title: 'Sports · 3D Basketball', kicker: 'SPORTS STARTER', card: 'CREATE BASKETBALL', project: 'Metro Exhibition', create: 'Create',
      hierarchy: ['Arena', 'Home player #1', 'Home players', 'Away players', 'Ball', 'Home hoop', 'Away hoop'],
      controls: [
        { keys: ['CLICK'], label: 'Click the court to focus', act: () => ({}) },
        { keys: ['W', 'A', 'S', 'D'], label: 'Move · Shift to sprint', act: lt => ({ move: Math.sin(lt * 2) }) },
        { keys: ['SPACE'], label: 'Hold, release in the green band to shoot', act: lt => ({ move: 1, charge: lt < 1.1 ? lt / 1.3 : null, shot: lt > 1.1 ? seg(lt, 1.1, 1.9) : 0, home: lt > 1.9 ? 2 : 0 }) },
        { keys: ['E'], label: 'Pass to a teammate', act: lt => ({ move: 1, home: 2, pass: seg(lt, .2, .9), shot: 1 }) },
        { keys: ['Q', 'F'], label: 'Switch teammate · try a steal', act: lt => ({ move: 1, home: 2, shot: 1 }) },
      ],
      goal: { title: 'Win the three-minute exhibition', lines: ['3v3: Metro Comets vs Harbor Waves, computer teammates and rivals.', 'Home attacks the Home hoop. Two- and three-point scoring.', 'Stop and replay resets the match.'], act: lt => ({ move: Math.sin(lt) * .8, shot: seg(lt % 2.5, 1, 2), home: Math.floor(lt / 2.5) * 2 + (lt % 2.5 > 2 ? 2 : 0), clock: `2:${String(59 - Math.floor(lt * 3)).padStart(2, '0')}` }) },
      edit: { pick: 'Arena', how: 'Select Arena in Hierarchy', panel: '3D Basketball', field: 'Arena: exhibition length (seconds)', from: '180', to: '300', note: 'Team names, court size, players and hoop rims are editable here too.' } }),
    G({ slug: 'blank', num: '10', title: 'Blank Canvas', kicker: 'START FROM SCRATCH', card: 'START FROM SCRATCH', project: 'My First World', create: 'Create',
      hierarchy: ['(empty scene)'],
      controls: [
        { keys: ['CLICK'], label: 'Hierarchy → add an object', act: lt => ({ cube: seg(lt, .4, 1.2) }) },
        { keys: ['CLICK'], label: 'Add a Player Controller to it', act: () => ({ cube: 1 }) },
        { keys: ['W', 'A', 'S', 'D'], label: 'Play Test: WASD or arrows move it', act: lt => ({ cube: 1, move: Math.sin(lt * 2.5) }) },
      ],
      goal: { title: 'Build your own game', lines: ['No starter characters, assets or rules.', 'Use the Hierarchy and building tools to add objects.', 'Add components, actions and HUD as your game grows.'], act: lt => ({ cube: seg(lt, .3, 1), move: Math.sin(lt * 1.5) * .6 }) },
      edit: { pick: 'Cube', how: 'Double-click your object', panel: 'Transform', field: 'Scale', from: '1', to: '2', note: 'Every object you add is yours to rename, restyle and script.' } }),
  ];
  const BY = Object.fromEntries(GUIDES.map(g => [g.slug, g]));

  function chapters(slug) {
    const g = BY[slug] || GUIDES[0];
    const ctrlDur = g.controls.length * 2.4 + .6;
    const list = [
      ['intro', 'Template', `How to work the ${g.title} template.`, 4.2],
      ['open', 'Open & name', `Choose the card on the Hub, name your project, then create it.`, 7.4],
      ['tour', 'Your scene', `Every piece of the starter is an editable object in the Hierarchy.`, 5.6],
      ['play', 'Play Test', `Press Play Test to try the game.`, 3.8],
      ['controls', 'Controls', `Controls`, ctrlDur],
      ['goal', 'Objective', g.goal.title, 6.4],
      ['stop', 'Stop', `Press Stop Test. Test changes reset; your authored scene is untouched.`, 4.2],
      ['edit', 'Edit', g.edit.how + ', change a setting, then Save Changes.', 7.6],
      ['save', 'Save', `Projects save in this browser. Project → Save downloads a project file.`, 5.6],
      ['outro', 'Recap', `Open · Play · Stop · Edit · Save.`, 4.4],
    ];
    let s = 0; return list.map(([id, title, caption, dur]) => { const c = { id, title, caption, start: s, end: s + dur, dur }; s += dur; return c; });
  }
  const duration = slug => { const c = chapters(slug); return c[c.length - 1].end; };

  // ---------- shared layout ----------
  const STAGE = { x: 120, y: 150, w: 1300, h: 760 };
  function backdrop(ctx, t) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(238,236,233,.035)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const g = ctx.createRadialGradient(W * .8, H * .1, 10, W * .8, H * .1, 900); g.addColorStop(0, 'rgba(216,71,58,.13)'); g.addColorStop(1, 'rgba(216,71,58,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function chrome(ctx, g, chs, ci, lt, t) {
    // top bar
    text(ctx, 'MADHORSE', 120, 86, { size: 30, weight: 800, track: 4 }); text(ctx, 'ENGINE', 290, 86, { size: 30, weight: 500, color: C.red, track: 4 });
    text(ctx, `TEMPLATE ${g.num} / 10  ·  ${g.kicker}`, 1800, 86, { size: 22, mono: true, color: C.muted, align: 'right', weight: 500 });
    ctx.fillStyle = C.line; ctx.fillRect(120, 108, 1680, 1);
    // chapter rail (right)
    const rx = 1490; text(ctx, 'STEPS', rx, 180, { size: 20, mono: true, color: C.dim });
    chs.forEach((c, i) => {
      if (c.id === 'intro' || c.id === 'outro') return;
      const y = 214 + (i - 1) * 74; const on = i === ci, done = i < ci;
      box(ctx, rx, y, 310, 58, 8, on ? 'rgba(216,71,58,.14)' : 'transparent', on ? C.red : C.line, on ? 2 : 1);
      text(ctx, String(i).padStart(2, '0'), rx + 18, y + 38, { size: 20, mono: true, color: on ? C.redSoft : done ? C.muted : C.dim });
      text(ctx, c.title.toUpperCase(), rx + 70, y + 39, { size: 28, weight: 700, color: on ? C.ink : done ? C.muted : C.dim, track: 1.5 });
      if (on) { ctx.fillStyle = C.red; ctx.fillRect(rx + 2, y + 54, 306 * seg(lt, 0, c.dur), 3); }
      if (done) { ctx.strokeStyle = C.muted; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(rx + 278, y + 30); ctx.lineTo(rx + 286, y + 38); ctx.lineTo(rx + 298, y + 22); ctx.stroke(); }
    });
    // caption
    const c = chs[ci]; const k = eo(seg(lt, .05, .5));
    ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * 14);
    box(ctx, 120, 948, 1300, 82, 10, C.panel, C.line, 1); ctx.fillStyle = C.red; ctx.fillRect(120, 948, 6, 82);
    text(ctx, c.title.toUpperCase(), 150, 998, { size: 22, mono: true, color: C.redSoft, weight: 600 });
    text(ctx, c.id === 'controls' ? curControl(g, lt).label : c.caption, 380, 1001, { size: 34, weight: 600 });
    ctx.restore();
    // global progress
    ctx.fillStyle = C.line; ctx.fillRect(1490, 1000, 310, 4); ctx.fillStyle = C.red; ctx.fillRect(1490, 1000, 310 * (t / chs[chs.length - 1].end), 4);
    text(ctx, fmt(t) + ' / ' + fmt(chs[chs.length - 1].end), 1800, 1030, { size: 18, mono: true, color: C.dim, align: 'right' });
  }
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const curControl = (g, lt) => g.controls[Math.min(g.controls.length - 1, Math.floor(Math.max(0, lt - .3) / 2.4))];

  // Studio mock frame inside STAGE. returns viewport rect.
  function studio(ctx, g, o) {
    const s = STAGE; box(ctx, s.x, s.y, s.w, s.h, 14, C.panel, C.line, 2);
    box(ctx, s.x, s.y, s.w, 58, 14, C.raised); ctx.fillStyle = C.raised; ctx.fillRect(s.x, s.y + 40, s.w, 18);
    text(ctx, 'Project', s.x + 26, s.y + 38, { size: 24, weight: 700, color: o.menu ? C.redSoft : C.ink });
    text(ctx, (o.name || g.project), s.x + 130, s.y + 38, { size: 24, weight: 500, color: C.muted });
    const playing = !!o.playing; const bx = s.x + s.w - 210;
    box(ctx, bx, s.y + 10, 190, 40, 8, playing ? C.red : 'transparent', playing ? C.redSoft : C.red, 2);
    ctx.fillStyle = playing ? '#fff' : C.red; if (playing) ctx.fillRect(bx + 22, s.y + 22, 16, 16); else { ctx.beginPath(); ctx.moveTo(bx + 22, s.y + 20); ctx.lineTo(bx + 40, s.y + 30); ctx.lineTo(bx + 22, s.y + 40); ctx.fill(); }
    text(ctx, playing ? 'Stop Test' : 'Play Test', bx + 54, s.y + 38, { size: 24, weight: 700, color: playing ? '#fff' : C.ink });
    // hierarchy
    const hx = s.x + 14, hy = s.y + 72, hw = 270; box(ctx, hx, hy, hw, s.h - 86, 8, C.bg, C.line, 1);
    text(ctx, 'HIERARCHY', hx + 16, hy + 32, { size: 18, mono: true, color: C.dim });
    const items = o.items || g.hierarchy;
    items.forEach((it, i) => { const k = o.itemsK == null ? 1 : clamp(o.itemsK * items.length - i); if (k <= 0) return; const y = hy + 52 + i * 44; const sel = o.sel === it; ctx.save(); ctx.globalAlpha = k; box(ctx, hx + 8, y, hw - 16, 36, 6, sel ? 'rgba(216,71,58,.22)' : 'transparent', sel ? C.red : null, 1.5); ctx.fillStyle = sel ? C.red : C.dim; ctx.fillRect(hx + 20, y + 14, 8, 8); text(ctx, it.length > 24 ? it.slice(0, 23) + '…' : it, hx + 38, y + 25, { size: 21, weight: 500, color: sel ? C.ink : C.muted }); ctx.restore(); });
    const vp = { x: hx + hw + 12, y: hy, w: s.x + s.w - (hx + hw + 12) - 14, h: s.h - 86 };
    if (o.inspector) vp.w -= 380;
    ctx.save(); rr(ctx, vp.x, vp.y, vp.w, vp.h, 8); ctx.clip(); (worlds[g.slug])(ctx, vp, o.t || 0, o.act || {}); ctx.restore();
    if (playing) { ctx.strokeStyle = C.red; ctx.lineWidth = 4; rr(ctx, vp.x, vp.y, vp.w, vp.h, 8); ctx.stroke(); box(ctx, vp.x + vp.w / 2 - 70, vp.y + 12, 140, 30, 15, C.red); text(ctx, '● PLAY TEST', vp.x + vp.w / 2, vp.y + 33, { size: 18, mono: true, align: 'center', color: '#fff', weight: 700 }); }
    return vp;
  }

  // ---------- chapters ----------
  function drawChapter(ctx, g, c, lt, t) {
    const d = c.dur;
    switch (c.id) {
      case 'intro': {
        const k1 = back(seg(lt, .1, .7)), k2 = eo(seg(lt, .5, 1.1)), k3 = eo(seg(lt, 1.1, 1.7));
        ctx.save(); ctx.globalAlpha = .9; const r = { x: 760, y: 170, w: 1040, h: 620 };
        ctx.translate(r.x + r.w / 2, r.y + r.h / 2); const sc = .9 + .1 * k2 + lt * .01; ctx.scale(sc, sc); ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
        ctx.globalAlpha = k2; ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.clip(); worlds[g.slug](ctx, r, t, introAct(g, lt)); ctx.restore(); box(ctx, r.x, r.y, r.w, r.h, 18, null, C.line, 2); ctx.restore();
        ctx.save(); ctx.globalAlpha = clamp(k1); text(ctx, g.num, 120, 470, { size: 300 * (.8 + .2 * k1), weight: 800, color: C.red }); ctx.restore();
        text(ctx, g.kicker, 128, 560, { size: 26, mono: true, color: C.muted, alpha: k2 });
        ctx.save(); ctx.globalAlpha = k3; ctx.translate(0, (1 - k3) * 24); wrap(ctx, g.title, 124, 650, 600, 84, { size: 86, weight: 800 }); ctx.restore();
        text(ctx, 'HOW TO WORK IT  →', 128, 880, { size: 28, mono: true, color: C.redSoft, alpha: eo(seg(lt, 1.8, 2.4)) });
        if (lt > d - .5) { ctx.fillStyle = `rgba(14,15,17,${seg(lt, d - .5, d)})`; ctx.fillRect(0, 120, 1440, 820); }
        return;
      }
      case 'open': {
        const s = STAGE; box(ctx, s.x, s.y, s.w, s.h, 14, C.panel, C.line, 2);
        text(ctx, '/madhorse-studio/', s.x + 28, s.y + 40, { size: 22, mono: true, color: C.dim }); const urlX = s.x + 34 + measureMono(ctx, '/madhorse-studio/', 22);
        const urlK = seg(lt, 1.6, 2.2); if (urlK > 0) text(ctx, `editor/?starter=${g.slug}`, urlX, s.y + 40, { size: 22, mono: true, color: C.redSoft, alpha: urlK });
        // hub card
        const cardK = 1 - eo(seg(lt, 1.9, 2.5)); const cx = s.x + 380, cy = s.y + 100;
        if (cardK > 0) { ctx.save(); ctx.globalAlpha = cardK; text(ctx, 'HUB · GAME STARTER TEMPLATES', s.x + 40, s.y + 96, { size: 20, mono: true, color: C.dim });
          for (let i = -1; i <= 1; i++) { const x = cx + i * 300 - 130, on = i === 0; box(ctx, x, cy + 30, 280, 520, 12, on ? C.raised : C.bg, on ? C.red : C.line, on ? 3 : 1); }
          text(ctx, `${g.num} / ${g.kicker}`.slice(0, 26), cx - 112, cy + 70, { size: 18, mono: true, color: C.muted });
          ctx.save(); rr(ctx, cx - 116, cy + 90, 252, 220, 8); ctx.clip(); worlds[g.slug](ctx, { x: cx - 116, y: cy + 90, w: 252, h: 220 }, t, {}); ctx.restore();
          wrap(ctx, g.title, cx - 112, cy + 360, 240, 40, { size: 36, weight: 800 });
          text(ctx, g.card + ' ↗', cx - 112, cy + 520, { size: 18, mono: true, color: C.redSoft, weight: 700 });
          ctx.restore(); }
        // dialog
        const dk = eo(seg(lt, 2.3, 2.9));
        if (dk > 0) { ctx.save(); ctx.globalAlpha = dk; const dx = s.x + 300, dy = s.y + 150 + (1 - dk) * 30, dw = 700;
          box(ctx, dx, dy, dw, 440, 14, C.raised, C.line, 2); text(ctx, 'New project from template', dx + 36, dy + 66, { size: 40, weight: 800 });
          wrap(ctx, 'Your other saved projects stay untouched.', dx + 36, dy + 112, dw - 72, 30, { size: 24, color: C.muted, weight: 500 });
          text(ctx, 'Project name', dx + 36, dy + 196, { size: 24, color: C.muted, weight: 600 });
          box(ctx, dx + 36, dy + 212, dw - 72, 64, 8, C.bg, lt > 3 ? C.red : C.line, 2);
          const n = Math.floor(clamp((lt - 3.1) / 1.6) * g.project.length); text(ctx, g.project.slice(0, n), dx + 56, dy + 254, { size: 32, weight: 600 });
          if (lt > 3 && lt < 5.3 && Math.floor(lt * 3) % 2 === 0) { ctx.fillStyle = C.ink; ctx.fillRect(dx + 60 + measure(ctx, g.project.slice(0, n), 32), dy + 228, 3, 34); }
          box(ctx, dx + dw - 380, dy + 340, 120, 56, 8, null, C.line, 1.5); text(ctx, 'Cancel', dx + dw - 320, dy + 376, { size: 24, align: 'center', color: C.muted });
          const pressed = lt > 5.6; box(ctx, dx + dw - 246, dy + 340, 210, 56, 8, pressed ? C.redSoft : C.red); text(ctx, lt > 5.8 ? 'Creating…' : g.create, dx + dw - 141, dy + 376, { size: g.create.length > 20 ? 19 : 24, align: 'center', weight: 700, color: '#fff' });
          ctx.restore(); }
        const cu = cursorAt(lt, [[0, 1100, 800], [1.0, cx + 20, cy + 400], [2.6, cx + 20, cy + 400], [2.9, s.x + 560, s.y + 390], [5.2, s.x + 560, s.y + 390], [5.5, s.x + 900, s.y + 520]], [1.15, 2.95, 5.6]);
        cursor(ctx, cu.x, cu.y, cu.c);
        if (lt > 6.6) { ctx.fillStyle = `rgba(14,15,17,${seg(lt, 6.6, 7.4)})`; ctx.fillRect(s.x, s.y, s.w, s.h); }
        return;
      }
      case 'tour': {
        const vp = studio(ctx, g, { itemsK: seg(lt, .3, 2.2), t, act: introAct(g, lt) });
        const k = eo(seg(lt, 2.4, 3)); if (k > 0) { ctx.save(); ctx.globalAlpha = k; const tx = STAGE.x + 300, ty = STAGE.y + 110; box(ctx, tx, ty, 420, 70, 8, 'rgba(14,15,17,.88)', C.red, 2); text(ctx, `${g.hierarchy.length} editable objects`, tx + 22, ty + 46, { size: 30, weight: 700 }); ctx.restore(); }
        return;
      }
      case 'play': case 'stop': {
        const isPlay = c.id === 'play'; const clickT = 1.4; const on = isPlay ? lt > clickT : lt < clickT;
        const g2 = isPlay ? (on ? controlAct(g, 0) : {}) : (on ? g.goal.act(4) : {});
        studio(ctx, g, { playing: on, t, act: g2 });
        const bx = STAGE.x + STAGE.w - 115, by = STAGE.y + 30; const cu = cursorAt(lt, [[0, bx - 300, by + 300], [1.1, bx, by]], [clickT]); cursor(ctx, cu.x, cu.y, cu.c);
        if (!isPlay && lt > 1.8) { const k = eo(seg(lt, 1.8, 2.4)); ctx.save(); ctx.globalAlpha = k; box(ctx, STAGE.x + 420, STAGE.y + 300, 620, 130, 12, 'rgba(14,15,17,.92)', C.line, 2); text(ctx, 'SCENE RESTORED', STAGE.x + 450, STAGE.y + 352, { size: 22, mono: true, color: C.redSoft }); text(ctx, 'Back to your authored starting state', STAGE.x + 450, STAGE.y + 400, { size: 34, weight: 700 }); ctx.restore(); }
        return;
      }
      case 'controls': {
        const idx = Math.min(g.controls.length - 1, Math.floor(Math.max(0, lt - .3) / 2.4)); const ctl = g.controls[idx]; const clt = Math.max(0, lt - .3 - idx * 2.4);
        const r = { x: STAGE.x, y: STAGE.y, w: 840, h: STAGE.h };
        ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, 14); ctx.clip(); worlds[g.slug](ctx, r, t, ctl.act(clt)); ctx.restore();
        ctx.strokeStyle = C.red; ctx.lineWidth = 3; rr(ctx, r.x, r.y, r.w, r.h, 14); ctx.stroke();
        box(ctx, r.x + 20, r.y + 20, 150, 32, 16, C.red); text(ctx, '● PLAY TEST', r.x + 95, r.y + 42, { size: 18, mono: true, align: 'center', color: '#fff', weight: 700 });
        // key panel
        const px = STAGE.x + 880, pw = STAGE.w - 880; box(ctx, px, STAGE.y, pw, STAGE.h, 14, C.panel, C.line, 1.5);
        text(ctx, 'CONTROLS', px + 30, STAGE.y + 52, { size: 22, mono: true, color: C.dim });
        const keys = ctl.keys; const kk = back(seg(clt, 0, .35));
        const kw = keys.map(k => k.length > 2 ? 132 : 92); const total = kw.reduce((a, b) => a + b, 0) + (keys.length - 1) * 14; let kx = px + pw / 2 - total / 2;
        ctx.save(); ctx.translate(px + pw / 2, STAGE.y + 190); ctx.scale(kk, kk); ctx.translate(-(px + pw / 2), -(STAGE.y + 190));
        keys.forEach((k, i) => { const on = Math.floor(clt * 3 + i) % keys.length === 0 || keys.length === 1 && Math.floor(clt * 3) % 2 === 0; key(ctx, k, kx, STAGE.y + 140, kw[i], 92, on); kx += kw[i] + 14; });
        ctx.restore();
        wrap(ctx, ctl.label, px + 30, STAGE.y + 330, pw - 60, 44, { size: 38, weight: 700, alpha: eo(seg(clt, .15, .5)) });
        g.controls.forEach((cc, i) => { const y = STAGE.y + 470 + i * 52; const on = i === idx; text(ctx, cc.keys.join(' · '), px + 30, y, { size: 20, mono: true, color: on ? C.redSoft : i < idx ? C.muted : C.dim, weight: 600 }); text(ctx, cc.label.length > 24 ? cc.label.slice(0, 23) + '…' : cc.label, px + 270, y, { size: 22, color: on ? C.ink : i < idx ? C.muted : C.dim, weight: 500 }); });
        return;
      }
      case 'goal': {
        const r = { x: STAGE.x + 420, y: STAGE.y, w: STAGE.w - 420, h: STAGE.h };
        ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, 14); ctx.clip(); worlds[g.slug](ctx, r, t, g.goal.act(lt)); ctx.restore(); box(ctx, r.x, r.y, r.w, r.h, 14, null, C.red, 3);
        text(ctx, 'OBJECTIVE', STAGE.x, STAGE.y + 40, { size: 22, mono: true, color: C.redSoft });
        ctx.save(); const k = eo(seg(lt, .1, .6)); ctx.globalAlpha = k; ctx.translate(-(1 - k) * 30, 0); wrap(ctx, g.goal.title, STAGE.x, STAGE.y + 120, 380, 66, { size: 64, weight: 800 }); ctx.restore();
        g.goal.lines.forEach((l, i) => { const kk = eo(seg(lt, 1 + i * 1.1, 1.5 + i * 1.1)); if (kk <= 0) return; ctx.save(); ctx.globalAlpha = kk; ctx.fillStyle = C.red; ctx.fillRect(STAGE.x, STAGE.y + 360 + i * 130, 26, 4); wrap(ctx, l, STAGE.x, STAGE.y + 400 + i * 130, 380, 34, { size: 28, weight: 500, color: C.ink }); ctx.restore(); });
        return;
      }
      case 'edit': {
        const e = g.edit; const items = g.slug === 'blank' ? ['Cube'] : g.hierarchy; const sel = lt > 1.3 ? e.pick : null;
        studio(ctx, g, { t, act: g.slug === 'blank' ? { cube: 1 } : introAct(g, 0), sel, items, inspector: lt > 1.5 });
        const idx = Math.max(0, items.indexOf(e.pick)); const iy = STAGE.y + 72 + 52 + idx * 44 + 18;
        let cu;
        if (lt > 1.5) {
          const k = eo(seg(lt, 1.5, 2)); const ix = STAGE.x + STAGE.w - 14 - 380 + (1 - k) * 40, iyy = STAGE.y + 72, iw = 380, ih = STAGE.h - 86;
          ctx.save(); ctx.globalAlpha = k; box(ctx, ix, iyy, iw, ih, 8, C.raised, C.line, 1.5);
          text(ctx, 'INSPECTOR', ix + 20, iyy + 34, { size: 18, mono: true, color: C.dim }); text(ctx, e.pick, ix + 20, iyy + 76, { size: 30, weight: 800 });
          box(ctx, ix + 16, iyy + 100, iw - 32, 2, 0, C.line); text(ctx, e.panel, ix + 20, iyy + 144, { size: 24, weight: 700, color: C.redSoft });
          wrap(ctx, e.field, ix + 20, iyy + 190, iw - 40, 28, { size: 22, color: C.muted });
          const fy = iyy + 236; box(ctx, ix + 20, fy, iw - 40, 56, 6, C.bg, lt > 2.6 && lt < 4.6 ? C.red : C.line, 2);
          const typed = lt < 3 ? e.from : e.to.slice(0, Math.floor(clamp((lt - 3) / 1.2) * e.to.length));
          text(ctx, typed.length > 24 ? typed.slice(0, 23) + '…' : typed, ix + 36, fy + 37, { size: 24, weight: 600, mono: /^\d/.test(typed) });
          wrap(ctx, e.note, ix + 20, fy + 110, iw - 40, 28, { size: 21, color: C.muted, weight: 500 });
          const saved = lt > 5.3; box(ctx, ix + 20, iyy + ih - 80, iw - 40, 58, 8, saved ? C.green : C.red); text(ctx, saved ? 'Saved ✓' : 'Save Changes', ix + iw / 2, iyy + ih - 42, { size: 26, weight: 700, align: 'center', color: '#fff' });
          ctx.restore();
          cu = cursorAt(lt, [[0, 900, 900], [1.1, STAGE.x + 140, iy], [2.4, STAGE.x + 140, iy], [2.8, ix + 200, fy + 28], [4.6, ix + 200, fy + 28], [5.0, ix + iw / 2, iyy + ih - 50]], [1.25, 2.85, 5.15]);
        } else cu = cursorAt(lt, [[0, 900, 900], [1.1, STAGE.x + 140, iy]], [1.25]);
        cursor(ctx, cu.x, cu.y, cu.c);
        return;
      }
      case 'save': {
        const open = lt > .9; studio(ctx, g, { t, act: introAct(g, 0), menu: open });
        const mx = STAGE.x + 16, my = STAGE.y + 56;
        if (open) { const k = eo(seg(lt, .9, 1.3)); ctx.save(); ctx.globalAlpha = k; box(ctx, mx, my, 330, 300, 10, C.raised, C.line, 2);
          ['Save', 'Export Web Game', 'New project', 'Rename project', 'Exit to Hub', 'Open saved project'].forEach((s, i) => { const hot = i === 0 && lt > 2; if (hot) box(ctx, mx + 8, my + 10 + i * 46, 314, 40, 6, 'rgba(216,71,58,.25)'); text(ctx, s, mx + 24, my + 38 + i * 46, { size: 24, weight: i === 0 ? 700 : 500, color: i === 0 ? C.ink : C.muted }); });
          ctx.restore(); }
        const cu = cursorAt(lt, [[0, 700, 600], [.8, mx + 40, STAGE.y + 30], [1.6, mx + 40, STAGE.y + 30], [2.0, mx + 90, my + 32]], [.9, 2.3]); cursor(ctx, cu.x, cu.y, cu.c);
        if (lt > 2.8) { const k = eo(seg(lt, 2.8, 3.3)); ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * 20); box(ctx, STAGE.x + 560, STAGE.y + 560, 680, 130, 12, 'rgba(14,15,17,.94)', C.green, 2);
          text(ctx, 'PROJECT FILE DOWNLOADED', STAGE.x + 590, STAGE.y + 606, { size: 20, mono: true, color: C.green });
          text(ctx, `${g.project} · scene data + imported files`, STAGE.x + 590, STAGE.y + 656, { size: 30, weight: 700 }); ctx.restore(); }
        return;
      }
      case 'outro': {
        const steps = ['Open & name', 'Play Test', 'Stop', 'Edit + Save Changes', 'Save project'];
        text(ctx, g.num, 120, 360, { size: 220, weight: 800, color: C.red, alpha: eo(seg(lt, 0, .5)) });
        wrap(ctx, g.title, 124, 470, 1200, 80, { size: 80, weight: 800, alpha: eo(seg(lt, .2, .7)) });
        steps.forEach((s, i) => { const k = back(seg(lt, .6 + i * .22, 1 + i * .22)); if (k <= 0) return; const x = 124 + i * 262; ctx.save(); ctx.globalAlpha = clamp(k); box(ctx, x, 620, 244, 130, 10, C.panel, i === 4 ? C.red : C.line, 2); text(ctx, String(i + 1).padStart(2, '0'), x + 20, 664, { size: 22, mono: true, color: C.redSoft }); wrap(ctx, s, x + 20, 710, 210, 30, { size: 28, weight: 700 }); ctx.restore(); });
        text(ctx, 'NOW MAKE IT YOURS.', 124, 860, { size: 40, weight: 800, color: C.muted, alpha: eo(seg(lt, 2, 2.6)), track: 3 });
        if (lt > d - .45) { ctx.fillStyle = `rgba(14,15,17,${seg(lt, d - .45, d)})`; ctx.fillRect(0, 0, W, H); }
        return;
      }
    }
  }
  function introAct(g, lt) { return g.goal.act(1.2 + (lt % 4) * .3); }
  function controlAct(g, lt) { return g.controls[0].act(lt); }
  function measureMono(ctx, s, size) { ctx.save(); ctx.font = `600 ${size}px ${MONO}`; const w = ctx.measureText(s).width; ctx.restore(); return w; }
  function measure(ctx, s, size) { ctx.save(); ctx.font = `600 ${size}px ${DISPLAY}`; const w = ctx.measureText(s).width; ctx.restore(); return w; }

  function draw(ctx, slug, t) {
    const g = BY[slug] || GUIDES[0]; const chs = chapters(g.slug); const total = chs[chs.length - 1].end;
    t = ((t % total) + total) % total;
    let ci = chs.findIndex(c => t >= c.start && t < c.end); if (ci < 0) ci = chs.length - 1; const c = chs[ci]; const lt = t - c.start;
    ctx.save(); backdrop(ctx, t);
    // shot entrance: subtle push for each chapter
    const k = eo(seg(lt, 0, .45)); ctx.save(); ctx.globalAlpha = c.id === 'intro' ? 1 : .35 + .65 * k; ctx.translate(0, (1 - k) * 18);
    drawChapter(ctx, g, c, lt, t); ctx.restore();
    if (c.id !== 'intro' && c.id !== 'outro') chrome(ctx, g, chs, ci, lt, t);
    else { text(ctx, 'MADHORSE', 120, 86, { size: 30, weight: 800, track: 4 }); text(ctx, 'ENGINE', 290, 86, { size: 30, weight: 500, color: C.red, track: 4 }); text(ctx, 'TEMPLATE TUTORIAL · SILENT GUIDE', 1800, 86, { size: 22, mono: true, color: C.muted, align: 'right' }); }
    ctx.restore();
  }

  function manifest() {
    return GUIDES.map(g => ({ slug: g.slug, title: g.title, number: g.num, projectName: g.project, duration: +duration(g.slug).toFixed(2),
      chapters: chapters(g.slug).map(c => ({ id: c.id, title: c.title, start: +c.start.toFixed(2), end: +c.end.toFixed(2), caption: c.id === 'controls' ? g.controls.map(x => `${x.keys.join('/')}: ${x.label}`).join(' · ') : c.caption })) }));
  }

  globalThis.TutorialEngine = { W, H, slugs: GUIDES.map(g => g.slug), guides: BY, chapters, duration, draw, manifest };
})();
