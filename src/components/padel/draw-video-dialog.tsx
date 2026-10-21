import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TournamentState } from '@/lib/padel/tournament';
import { INTRO_END, REVEAL_END, VIDEO_HEIGHT as H, VIDEO_SECONDS, VIDEO_WIDTH as W, pickVideoFormat, revealSequence, revealTime, teamLabel, videoColumns, type Reveal } from '@/lib/padel/draw-video';

// Canvas pixels cannot read CSS tokens directly; read them from the theme at render time.
function palette() {
  const css = getComputedStyle(document.documentElement);
  const v = (n: string, f: string) => css.getPropertyValue(n).trim() || f;
  return { bg: v('--sidebar', '#0b2a22'), card: v('--card', '#ffffff'), fg: v('--card-foreground', '#10221c'), accent: v('--accent', '#c6f432'), primary: v('--primary', '#0f5c46'), light: '#ffffff', muted: v('--muted-foreground', '#6b7c75') };
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) { let t = text; while (ctx.measureText(t).width > max && t.length > 3) t = t.slice(0, -2); return t === text ? t : `${t}…`; }
const ease = (x: number) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);

function drawFrame(ctx: CanvasRenderingContext2D, t: number, state: TournamentState, seq: Reveal[], c: ReturnType<typeof palette>) {
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (t < INTRO_END) {
    const p = ease(t / 1.2);
    ctx.globalAlpha = p; ctx.fillStyle = c.accent; ctx.font = '600 44px "DM Sans", sans-serif'; ctx.fillText('TIRAGE AU SORT', W / 2, 760);
    ctx.fillStyle = c.light; ctx.font = `800 ${150 + 20 * p}px Barlow, sans-serif`; ctx.fillText('ZE PADEL', W / 2, 900);
    ctx.font = '500 46px "DM Sans", sans-serif'; ctx.fillText('P100 · Tournoi multi-chances · 16 équipes', W / 2, 1040);
    ctx.fillStyle = c.accent; ctx.fillRect(W / 2 - 200 * p, 1120, 400 * p, 8); ctx.globalAlpha = 1; return;
  }
  if (t < REVEAL_END + 0.5) {
    const n = seq.length; const idx = Math.min(n - 1, Math.floor((t - INTRO_END) / ((REVEAL_END - INTRO_END) / n)));
    const cur = seq[idx]!; const local = (t - revealTime(idx, n)) / ((REVEAL_END - INTRO_END) / n);
    ctx.fillStyle = c.accent; ctx.font = '700 52px Barlow, sans-serif';
    ctx.fillText(cur.seed ? 'TÊTES DE SÉRIE' : `TIRAGE RANGS ${cur.band}`, W / 2, 200);
    // wheel
    const cx = W / 2, cy = 640, r = 330, spin = (1 - ease(local * 1.6)) * 10 + idx * 1.3;
    for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, spin + (i * Math.PI) / 8, spin + ((i + 1) * Math.PI) / 8); ctx.fillStyle = i % 2 ? c.primary : c.accent; ctx.globalAlpha = 0.85; ctx.fill(); }
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2); ctx.fillStyle = c.bg; ctx.fill();
    ctx.fillStyle = c.light; ctx.font = '800 96px Barlow, sans-serif'; ctx.fillText(local > 0.45 ? String(cur.team.rank) : '?', cx, cy + 4);
    ctx.beginPath(); ctx.moveTo(cx - 34, cy - r - 40); ctx.lineTo(cx + 34, cy - r - 40); ctx.lineTo(cx, cy - r + 20); ctx.fillStyle = c.light; ctx.fill();
    if (local > 0.45) { const p = ease((local - 0.45) * 4); ctx.globalAlpha = p; rounded(ctx, 90, 1050 + 40 * (1 - p), W - 180, 190, 28); ctx.fillStyle = c.card; ctx.fill(); ctx.fillStyle = c.fg; ctx.font = '700 54px Barlow, sans-serif'; ctx.fillText(fit(ctx, teamLabel(cur.team), W - 260), W / 2, 1120 + 40 * (1 - p)); ctx.fillStyle = c.muted; ctx.font = '500 36px "DM Sans", sans-serif'; ctx.fillText(`${cur.seed ? `TS${cur.team.rank}` : `Rang ${cur.team.rank}`} · case ${cur.slot}`, W / 2, 1190 + 40 * (1 - p)); ctx.globalAlpha = 1; }
    // revealed list
    ctx.font = '600 30px "DM Sans", sans-serif'; ctx.textAlign = 'left';
    seq.slice(0, idx + (local > 0.45 ? 1 : 0)).forEach((s, i) => { const x = i % 2 ? W / 2 + 10 : 70; const y = 1340 + Math.floor(i / 2) * 64; ctx.fillStyle = s.seed ? c.accent : c.light; ctx.fillText(fit(ctx, `${s.team.rank}. ${teamLabel(s.team)}`, W / 2 - 90), x, y); });
    ctx.textAlign = 'center'; return;
  }
  // final board: 3 columns only
  const p = ease((t - REVEAL_END - 0.5) / 1.2); ctx.globalAlpha = p;
  ctx.fillStyle = c.light; ctx.font = '800 84px Barlow, sans-serif'; ctx.fillText('ZE PADEL · LE TABLEAU', W / 2, 120);
  const cols = videoColumns(state); const colW = 330, gap = 25, x0 = (W - (colW * 3 + gap * 2)) / 2;
  cols.forEach((col, ci) => {
    const x = x0 + ci * (colW + gap);
    ctx.fillStyle = c.accent; ctx.font = '700 38px Barlow, sans-serif'; ctx.fillText(col.title.toUpperCase(), x + colW / 2, 230);
    const slotH = 1580 / 4;
    col.matches.forEach((m, mi) => {
      const y = 290 + mi * slotH + slotH / 2 - 110;
      rounded(ctx, x, y, colW, 220, 20); ctx.fillStyle = c.card; ctx.fill();
      m.forEach((e, ei) => { const ey = y + 58 + ei * 104; if (e.seed) { rounded(ctx, x + 8, ey - 46, colW - 16, 92, 14); ctx.fillStyle = c.accent; ctx.fill(); }
        ctx.textAlign = 'left'; ctx.fillStyle = e.rank ? c.fg : c.muted; ctx.font = `${e.rank ? '700' : 'italic 500'} 26px "DM Sans", sans-serif`;
        const [a, b] = e.label.split(' / '); const tag = e.seed ? `TS${e.rank} ` : e.rank ? `${e.rank}. ` : '';
        ctx.fillText(fit(ctx, `${tag}${a}`, colW - 36), x + 20, b ? ey - 16 : ey); if (b) ctx.fillText(fit(ctx, b, colW - 36), x + 20, ey + 18); ctx.textAlign = 'center'; });
      ctx.fillStyle = c.muted; ctx.fillRect(x + 20, y + 110, colW - 40, 2);
    });
  });
  ctx.fillStyle = c.light; ctx.font = '500 32px "DM Sans", sans-serif'; ctx.fillText('Surligné : tête de série · 1 set de 9 jeux', W / 2, H - 50); ctx.globalAlpha = 1;
}

function scheduleSounds(ac: AudioContext, out: AudioNode, seq: Reveal[]) {
  const tone = (at: number, f: number, d: number, type: OscillatorType, vol: number, slideTo?: number) => {
    const o = ac.createOscillator(); const g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, ac.currentTime + at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + at + d);
    g.gain.setValueAtTime(0.0001, ac.currentTime + at); g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + d);
    o.connect(g).connect(out); o.start(ac.currentTime + at); o.stop(ac.currentTime + at + d + 0.05);
  };
  tone(0.2, 220, 0.8, 'sawtooth', 0.12, 880); // whoosh intro
  seq.forEach((_, i) => { const at = revealTime(i, seq.length); for (let k = 0; k < 6; k++) tone(at + k * 0.07, 1400, 0.03, 'square', 0.05); tone(at + 0.5, 660, 0.25, 'triangle', 0.25); tone(at + 0.58, 990, 0.3, 'triangle', 0.2); });
  [523, 659, 784, 1047].forEach((f, i) => tone(REVEAL_END + 0.5 + i * 0.12, f, 0.6, 'triangle', 0.22)); // final fanfare (synthesised, libre de droits)
}

export function DrawVideoDialog({ state, onClose }: { state: TournamentState; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0); const [error, setError] = useState('');
  const [file, setFile] = useState<{ url: string; name: string; label: string; size: number } | null>(null);
  const format = typeof MediaRecorder !== 'undefined' ? pickVideoFormat(t => MediaRecorder.isTypeSupported(t)) : null;
  useEffect(() => { const ctx = canvasRef.current?.getContext('2d'); if (ctx) drawFrame(ctx, REVEAL_END + 3, state, revealSequence(state), palette()); }, [state]);
  useEffect(() => () => { if (file) URL.revokeObjectURL(file.url); }, [file]);

  async function generate() {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !format) { setPhase('error'); setError("Votre navigateur ne permet pas d'enregistrer une vidéo. Essayez Chrome, Edge ou Safari récent."); return; }
    setPhase('recording'); setProgress(0); setFile(null);
    await document.fonts?.ready;
    const seq = revealSequence(state); const colors = palette();
    const stream = canvas.captureStream(30);
    let ac: AudioContext | null = null;
    try { ac = new AudioContext(); const dest = ac.createMediaStreamDestination(); scheduleSounds(ac, dest, seq); dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr)); } catch { ac = null; }
    const rec = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 8_000_000 }); const chunks: Blob[] = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => { stream.getTracks().forEach(tr => tr.stop()); void ac?.close(); const blob = new Blob(chunks, { type: format.mime.split(';')[0] });
      if (!blob.size) { setPhase('error'); setError('La vidéo est vide. Gardez cet onglet visible pendant la génération.'); return; }
      setFile({ url: URL.createObjectURL(blob), name: `tirage-ze-padel.${format.ext}`, label: format.label, size: blob.size }); setPhase('done'); };
    rec.start(500); const start = performance.now();
    const loop = () => { const t = (performance.now() - start) / 1000; drawFrame(ctx, t, state, seq, colors); setProgress(Math.min(1, t / VIDEO_SECONDS)); if (t < VIDEO_SECONDS) requestAnimationFrame(loop); else rec.stop(); };
    requestAnimationFrame(loop);
  }
  function download() { if (!file) return; const a = document.createElement('a'); a.href = file.url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); }

  return <div className="modal-backdrop" onClick={() => phase !== 'recording' && onClose()}><section className="modal video-modal" role="dialog" aria-modal="true" aria-labelledby="video-title" onClick={e => e.stopPropagation()}>
    <Button size="icon" variant="ghost" className="modal-close" aria-label="Fermer" disabled={phase === 'recording'} onClick={onClose}><X /></Button>
    <span className="modal-eyebrow">INSTAGRAM REELS · 9:16</span><h2 id="video-title">Vidéo du tirage</h2>
    <canvas ref={canvasRef} width={W} height={H} className="video-canvas" aria-label="Aperçu de la vidéo" />
    <p className="text-sm text-muted-foreground mt-3">1080×1920 · {VIDEO_SECONDS} s · format exporté : <strong>{format?.label ?? 'non pris en charge'}</strong>{format && format.ext !== 'mp4' && ' — votre navigateur ne sait pas créer de MP4 H.264 ; convertissez le fichier ou utilisez Safari/Chrome récent si Instagram le refuse.'}</p>
    {phase === 'recording' && <p className="text-sm mt-2" role="status">Enregistrement en temps réel… {Math.round(progress * 100)} % — gardez cet onglet ouvert et visible.</p>}
    {error && <p className="text-destructive text-sm mt-2" role="alert">{error}</p>}
    <div className="flex gap-3 mt-4"><Button className="flex-1" disabled={phase === 'recording' || !format} onClick={generate}><Clapperboard />{phase === 'done' ? 'Régénérer' : 'Générer la vidéo du tirage'}</Button>
      {file && <Button variant="outline" className="flex-1" onClick={download}><Download />Télécharger ({(file.size / 1e6).toFixed(1)} Mo)</Button>}</div>
  </section></div>;
}