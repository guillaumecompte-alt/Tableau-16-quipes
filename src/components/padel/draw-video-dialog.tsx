import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TournamentState } from '@/lib/padel/tournament';
import {
  INTRO_END,
  REVEAL_END,
  VIDEO_HEIGHT as H,
  VIDEO_SECONDS,
  VIDEO_WIDTH as W,
  pickVideoFormat,
  revealSequence,
  revealTime,
  teamLabel,
  videoColumns,
  type Reveal,
  type VideoEntry,
} from '@/lib/padel/draw-video';

const COLORS = {
  bg: '#f3f8ff',
  navy: '#09254a',
  blue: '#1265b5',
  bluePale: '#eaf3fd',
  line: '#cbdcf0',
  yellow: '#ffd43b',
  white: '#ffffff',
  ink: '#09254a',
  muted: '#607895',
  mutedLight: '#9aacc1',
};

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  let value = text;
  while (ctx.measureText(value).width > max && value.length > 3) value = value.slice(0, -2);
  return value === text ? value : value + '…';
}

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

function drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, turn: number, current: Reveal | undefined, currentRevealed: boolean, revealedCount: number, spinning: boolean) {
  const cx = x;
  const cy = y;
  const spin = turn * Math.PI / 180;
  const count = 16;
  for (let i = 0; i < count; i++) {
    const start = spin + i * Math.PI * 2 / count - Math.PI / 2;
    const end = spin + (i + 1) * Math.PI * 2 / count - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? COLORS.blue : COLORS.yellow;
    ctx.fill();
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 3;
    ctx.stroke();
    const a = (start + end) / 2;
    ctx.fillStyle = i % 2 ? COLORS.white : COLORS.navy;
    ctx.font = '700 16px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), cx + Math.cos(a) * radius * 0.77, cy + Math.sin(a) * radius * 0.77);
  }
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.navy;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 35, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.navy;
  ctx.fill();
  ctx.strokeStyle = COLORS.yellow;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = COLORS.white;
  ctx.font = '800 15px Barlow, sans-serif';
  ctx.fillText(current && currentRevealed ? String(current.team.rank) : 'ZE', cx, cy - 6);
  ctx.fillStyle = COLORS.yellow;
  ctx.font = '800 11px Barlow, sans-serif';
  ctx.fillText(current && currentRevealed ? 'RANG' : 'PADEL', cx, cy + 10);

  ctx.beginPath();
  ctx.moveTo(cx - 16, cy - radius - 23);
  ctx.lineTo(cx + 16, cy - radius - 23);
  ctx.lineTo(cx, cy - radius + 3);
  ctx.closePath();
  ctx.fillStyle = COLORS.navy;
  ctx.fill();
  if (spinning) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(revealedCount / 16));
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
}

function drawEntry(ctx: CanvasRenderingContext2D, entry: VideoEntry, x: number, top: number, width: number, justRevealed: boolean) {
  if (justRevealed && entry.rank) {
    rounded(ctx, x + 5, top + 4, width - 10, 83, 11);
    ctx.fillStyle = '#fff4bf';
    ctx.fill();
  } else if (entry.seed) {
    rounded(ctx, x + 5, top + 4, width - 10, 83, 11);
    ctx.fillStyle = '#fff8d7';
    ctx.fill();
  }

  const badgeX = x + 13;
  const badgeY = top + 29;
  rounded(ctx, badgeX, badgeY, 29, 29, 5);
  ctx.fillStyle = entry.rank ? (entry.seed ? COLORS.yellow : COLORS.bluePale) : '#e9f1fa';
  ctx.fill();
  ctx.fillStyle = entry.rank && entry.seed ? COLORS.navy : (entry.rank ? COLORS.blue : COLORS.mutedLight);
  ctx.font = '700 15px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(entry.rank ? String(entry.rank) : '—', badgeX + 14.5, badgeY + 14.5);

  ctx.textAlign = 'left';
  if (entry.rank) {
    const split = entry.label.split(' / ');
    const available = width - 61;
    ctx.fillStyle = COLORS.ink;
    ctx.font = '700 16px "DM Sans", sans-serif';
    ctx.fillText(fit(ctx, split[0] ?? entry.label, available), x + 51, top + 34);
    if (split[1]) {
      ctx.fillStyle = COLORS.navy;
      ctx.font = '500 16px "DM Sans", sans-serif';
      ctx.fillText(fit(ctx, split[1], available), x + 51, top + 58);
    }
  } else if (entry.label === 'À tirer') {
    ctx.fillStyle = COLORS.mutedLight;
    ctx.font = '500 14px "DM Sans", sans-serif';
    ctx.fillText('Emplacement en attente', x + 51, top + 48);
    ctx.strokeStyle = '#dce7f4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 51, top + 64);
    ctx.lineTo(x + width - 14, top + 64);
    ctx.stroke();
  } else {
    ctx.fillStyle = COLORS.muted;
    ctx.font = '500 15px "DM Sans", sans-serif';
    ctx.fillText(fit(ctx, entry.label, width - 66), x + 51, top + 48);
  }
}

function drawBracket(ctx: CanvasRenderingContext2D, t: number, state: TournamentState, visibleSlots: ReadonlySet<string>, current: Reveal | undefined, revealActive: boolean) {
  const columns = videoColumns(state, visibleSlots);
  const x0 = 24;
  const columnWidth = 324;
  const gap = 30;
  const headingY = 477;
  const cardTop = 505;
  const rowPitch = 292;
  const cardHeight = 270;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.navy;
  ctx.font = '800 30px Barlow, sans-serif';
  const heading = t < INTRO_END
    ? 'LE TABLEAU EST PRÊT'
    : revealActive
      ? 'LE TABLEAU SE REMPLIT AU FIL DU TIRAGE'
      : 'TABLEAU DU TOURNOI';
  ctx.fillText(heading, W / 2, 429);

  columns.forEach((column, columnIndex) => {
    const x = x0 + columnIndex * (columnWidth + gap);
    ctx.fillStyle = COLORS.blue;
    ctx.font = '800 23px Barlow, sans-serif';
    ctx.fillText(fit(ctx, column.title.toUpperCase(), columnWidth - 8), x + columnWidth / 2, headingY);

    column.matches.forEach((match, matchIndex) => {
      const y = cardTop + matchIndex * rowPitch;
      rounded(ctx, x, y, columnWidth, cardHeight, 13);
      ctx.fillStyle = COLORS.white;
      ctx.fill();
      ctx.strokeStyle = COLORS.line;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.muted;
      ctx.font = '700 13px "DM Sans", sans-serif';
      const matchNumber = columnIndex === 0 ? matchIndex + 1 : columnIndex === 1 ? matchIndex + 5 : matchIndex + 13;
      ctx.fillText('MATCH ' + String(matchNumber).padStart(2, '0'), x + 15, y + 22);
      ctx.strokeStyle = '#e4edf7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 1, y + 42);
      ctx.lineTo(x + columnWidth - 1, y + 42);
      ctx.stroke();

      const firstTop = y + 43;
      const secondTop = y + 133;
      drawEntry(ctx, match[0], x, firstTop, columnWidth, Boolean(revealActive && current && match[0].rank === current.team.rank));
      drawEntry(ctx, match[1], x, secondTop, columnWidth, Boolean(revealActive && current && match[1].rank === current.team.rank));

      ctx.strokeStyle = '#d9e6f4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 1, y + 132);
      ctx.lineTo(x + columnWidth - 1, y + 132);
      ctx.moveTo(x + 1, y + 224);
      ctx.lineTo(x + columnWidth - 1, y + 224);
      ctx.stroke();

      ctx.fillStyle = COLORS.muted;
      ctx.font = '500 12px "DM Sans", sans-serif';
      ctx.fillText('À jouer', x + 15, y + 247);
      ctx.textAlign = 'right';
      ctx.fillText('D2 · 9 jeux', x + columnWidth - 15, y + 247);
      ctx.textAlign = 'center';
    });
  });

  ctx.fillStyle = COLORS.muted;
  ctx.font = '500 20px "DM Sans", sans-serif';
  ctx.fillText('Têtes de série surlignées en jaune', W / 2, 1770);
  rounded(ctx, 150, 1810, W - 300, 10, 5);
  ctx.fillStyle = '#dce7f4';
  ctx.fill();
  rounded(ctx, 150, 1810, (W - 300) * (visibleSlots.size / 16), 10, 5);
  ctx.fillStyle = COLORS.blue;
  ctx.fill();
  ctx.fillStyle = COLORS.muted;
  ctx.font = '600 15px "DM Sans", sans-serif';
  ctx.fillText(String(visibleSlots.size) + ' / 16 équipes révélées', W / 2, 1844);
}

function drawFrame(ctx: CanvasRenderingContext2D, t: number, state: TournamentState, sequence: Reveal[]) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  const interval = (REVEAL_END - INTRO_END) / Math.max(sequence.length, 1);
  const rawIndex = Math.floor((t - INTRO_END) / interval);
  const index = Math.min(sequence.length - 1, Math.max(0, rawIndex));
  const local = t < INTRO_END ? 0 : (t - revealTime(index, sequence.length)) / interval;
  const revealCount = t < INTRO_END ? 0 : t >= REVEAL_END ? sequence.length : Math.min(sequence.length, index + (local >= 0.48 ? 1 : 0));
  const visible = new Set(sequence.slice(0, revealCount).map(item => item.slot));
  const current = t >= INTRO_END && t < REVEAL_END ? sequence[index] : undefined;
  const revealActive = t >= INTRO_END && t < REVEAL_END;
  const spinDegrees = revealActive ? index * 145 + ease(local) * 330 : revealCount * 23;

  rounded(ctx, 25, 22, W - 50, 116, 20);
  ctx.fillStyle = COLORS.navy;
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.white;
  ctx.font = '800 44px Barlow, sans-serif';
  ctx.fillText('ZE PADEL', 54, 61);
  ctx.fillStyle = COLORS.yellow;
  ctx.font = '700 22px "DM Sans", sans-serif';
  ctx.fillText('TIRAGE AU SORT · P100 · 16 ÉQUIPES', 56, 105);
  rounded(ctx, 863, 52, 163, 47, 22);
  ctx.fillStyle = COLORS.blue;
  ctx.fill();
  ctx.fillStyle = COLORS.white;
  ctx.textAlign = 'center';
  ctx.font = '700 19px "DM Sans", sans-serif';
  ctx.fillText(t >= REVEAL_END ? 'TIRAGE TERMINÉ' : revealActive ? 'EN DIRECT' : 'BIENTÔT', 944, 76);

  // Compact wheel: about 210 px diameter.
  drawWheel(ctx, 151, 274, 101, spinDegrees, current, Boolean(current && visible.has(current.slot)), revealCount, revealActive && local < 0.5);

  rounded(ctx, 282, 163, 772, 224, 18);
  ctx.fillStyle = COLORS.white;
  ctx.fill();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.blue;
  ctx.font = '800 15px "DM Sans", sans-serif';
  ctx.fillText(t >= REVEAL_END ? 'RÉSULTAT COMPLET' : revealActive ? 'RÉSULTAT DU TIRAGE' : 'LE TIRAGE COMMENCE', 310, 192);

  if (t < INTRO_END) {
    ctx.fillStyle = COLORS.navy;
    ctx.font = '800 29px Barlow, sans-serif';
    ctx.fillText('Les équipes vont remplir le tableau', 310, 238);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '500 18px "DM Sans", sans-serif';
    ctx.fillText('Chaque paire apparaîtra dans sa véritable case.', 310, 272);
    ctx.fillText('La roue reste volontairement compacte.', 310, 300);
  } else if (t >= REVEAL_END) {
    ctx.fillStyle = COLORS.navy;
    ctx.font = '800 31px Barlow, sans-serif';
    ctx.fillText('Les 16 équipes sont placées', 310, 244);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '500 20px "DM Sans", sans-serif';
    ctx.fillText('Voici le tableau final du tournoi.', 310, 282);
  } else if (current) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = '700 14px "DM Sans", sans-serif';
    ctx.fillText(current.seed ? 'TÊTE DE SÉRIE' : 'GROUPE DES RANGS ' + current.band, 310, 225);
    if (local >= 0.48) {
      rounded(ctx, 302, 242, 732, 77, 12);
      ctx.fillStyle = '#fff4bf';
      ctx.fill();
      ctx.fillStyle = COLORS.navy;
      ctx.font = '800 25px Barlow, sans-serif';
      ctx.fillText(fit(ctx, teamLabel(current.team), 700), 322, 270);
      ctx.fillStyle = COLORS.blue;
      ctx.font = '600 15px "DM Sans", sans-serif';
      ctx.fillText('Rang ' + current.team.rank + ' · emplacement ' + current.slot, 322, 300);
    } else {
      ctx.fillStyle = COLORS.navy;
      ctx.font = '800 31px Barlow, sans-serif';
      ctx.fillText('La roue tourne…', 310, 272);
      ctx.fillStyle = COLORS.muted;
      ctx.font = '500 17px "DM Sans", sans-serif';
      ctx.fillText('Prochaine équipe en cours de tirage', 310, 305);
    }
  }

  rounded(ctx, 310, 348, 715, 9, 5);
  ctx.fillStyle = '#dce7f4';
  ctx.fill();
  rounded(ctx, 310, 348, 715 * (revealCount / 16), 9, 5);
  ctx.fillStyle = COLORS.blue;
  ctx.fill();
  drawBracket(ctx, t, state, visible, current, revealActive);
}

function scheduleSounds(ac: AudioContext, out: AudioNode, sequence: Reveal[]) {
  const tone = (at: number, frequency: number, duration: number, type: OscillatorType, volume: number, slideTo?: number) => {
    const oscillator = ac.createOscillator();
    const gain = ac.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ac.currentTime + at);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + at + duration);
    gain.gain.setValueAtTime(0.0001, ac.currentTime + at);
    gain.gain.exponentialRampToValueAtTime(volume, ac.currentTime + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + duration);
    oscillator.connect(gain).connect(out);
    oscillator.start(ac.currentTime + at);
    oscillator.stop(ac.currentTime + at + duration + 0.05);
  };
  tone(0.2, 220, 0.8, 'sawtooth', 0.12, 880);
  const interval = (REVEAL_END - INTRO_END) / Math.max(sequence.length, 1);
  sequence.forEach((_, index) => {
    const at = revealTime(index, sequence.length);
    for (let tick = 0; tick < 5; tick++) tone(at + tick * 0.09, 1400, 0.035, 'square', 0.045);
    tone(at + interval * 0.5, 660, 0.25, 'triangle', 0.22);
    tone(at + interval * 0.53, 990, 0.3, 'triangle', 0.17);
  });
  // Play the short final fanfare before the reveal phase ends.
  // Every oscillator is stopped before the final static-board screen begins.
  const fanfareStart = Math.max(0, REVEAL_END - 0.65);
  [523, 659, 784, 1047].forEach((frequency, index) =>
    tone(fanfareStart + index * 0.08, frequency, 0.14, 'triangle', 0.16)
  );
}

export function DrawVideoDialog({ state, onClose }: { state: TournamentState; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [file, setFile] = useState<{ url: string; name: string; label: string; size: number } | null>(null);
  const format = typeof MediaRecorder !== 'undefined' ? pickVideoFormat(type => MediaRecorder.isTypeSupported(type)) : null;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawFrame(ctx, VIDEO_SECONDS, state, revealSequence(state));
  }, [state]);

  useEffect(() => () => { if (file) URL.revokeObjectURL(file.url); }, [file]);

  async function generate() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !format) {
      setPhase('error');
      setError("Votre navigateur ne permet pas d'enregistrer une vidéo. Essaie Chrome, Edge ou Safari récent.");
      return;
    }
    setPhase('recording');
    setProgress(0);
    setError('');
    if (file) URL.revokeObjectURL(file.url);
    setFile(null);
    await document.fonts?.ready;
    const sequence = revealSequence(state);
    const stream = canvas.captureStream(30);
    let audioContext: AudioContext | null = null;
    try {
      audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      scheduleSounds(audioContext, destination, sequence);
      destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
    } catch {
      audioContext = null;
    }

    const recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => {
      setPhase('error');
      setError("L'enregistrement a échoué. Essaie un navigateur récent et garde l'onglet au premier plan.");
      stream.getTracks().forEach(track => track.stop());
      void audioContext?.close();
    };
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      void audioContext?.close();
      const blob = new Blob(chunks, { type: format.mime.split(';')[0] });
      if (!blob.size) {
        setPhase('error');
        setError('La vidéo est vide. Garde cet onglet ouvert et visible pendant la génération.');
        return;
      }
      setFile({ url: URL.createObjectURL(blob), name: 'tirage-ze-padel.' + format.ext, label: format.label, size: blob.size });
      setPhase('done');
    };
    recorder.start(500);
    const start = performance.now();
    const loop = () => {
      const elapsed = (performance.now() - start) / 1000;
      drawFrame(ctx, elapsed, state, sequence);
      setProgress(Math.min(1, elapsed / VIDEO_SECONDS));
      if (elapsed < VIDEO_SECONDS) requestAnimationFrame(loop);
      else recorder.stop();
    };
    requestAnimationFrame(loop);
  }

  function download() {
    if (!file) return;
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return <div className="modal-backdrop" onClick={() => phase !== 'recording' && onClose()}>
    <section className="modal video-modal" role="dialog" aria-modal="true" aria-labelledby="video-title" onClick={event => event.stopPropagation()}>
      <Button size="icon" variant="ghost" className="modal-close" aria-label="Fermer" disabled={phase === 'recording'} onClick={onClose}><X /></Button>
      <span className="modal-eyebrow">INSTAGRAM REELS · 9:16</span>
      <h2 id="video-title">Vidéo du tirage</h2>
      <canvas ref={canvasRef} width={W} height={H} className="video-canvas" aria-label="Aperçu : tableau se remplissant au fil du tirage" />
      <p className="text-sm text-muted-foreground mt-3">
        1080×1920 · {VIDEO_SECONDS} s maximum · format exporté : <strong>{format?.label ?? 'non pris en charge'}</strong>
        {format && format.ext !== 'mp4' && ' — votre navigateur ne sait pas créer un MP4 H.264 ; convertis le fichier si Instagram refuse WebM.'}
      </p>
      {phase === 'recording' && <p className="text-sm mt-2" role="status">Enregistrement en temps réel… {Math.round(progress * 100)} % — garde cet onglet ouvert et visible.</p>}
      {error && <p className="text-destructive text-sm mt-2" role="alert">{error}</p>}
      <div className="flex gap-3 mt-4">
        <Button className="flex-1" disabled={phase === 'recording' || !format} onClick={generate}><Clapperboard />{phase === 'done' ? 'Régénérer' : 'Générer la vidéo du tirage'}</Button>
        {file && <Button variant="outline" className="flex-1" onClick={download}><Download />Télécharger ({(file.size / 1e6).toFixed(1)} Mo)</Button>}
      </div>
    </section>
  </div>;
}
