import { useRef, useState } from 'react';
import { Shuffle, GitBranch, Trophy, CheckCheck, Users, X, RotateCcw, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bands, canDraw, isTeamComplete, drawAll, drawBand, initialState, matches, type TournamentState, type Team } from '@/lib/padel/tournament';
import { useTournament } from './use-tournament';
import { MatchCard } from './match-card';

type RoundGroup = { title: string; ids: number[]; detail?: string };
const mainGroups: RoundGroup[] = [{ title: '1er tour', ids: [1, 2, 3, 4], detail: 'Rangs 9 à 16' }, { title: '2e tour', ids: [5, 6, 7, 8], detail: 'Entrée des rangs 5 à 8' }, { title: 'Quarts de finale', ids: [13, 14, 15, 16], detail: 'Entrée des têtes de série' }, { title: 'Demi-finales', ids: [23, 24], detail: 'Dernier carré' }, { title: 'Finale', ids: [28], detail: 'Le titre en jeu' }];
const placementGroups: RoundGroup[] = [{ title: 'Places 13 à 16', ids: [9, 10, 17, 18] }, { title: 'Places 9 à 12', ids: [11, 12, 19, 20] }, { title: 'Places 5 à 8', ids: [21, 22, 26, 25] }, { title: '3e / 4e place', ids: [27] }];

type WheelPick = { band: string; slot: string; rank: number };
type WheelRun = {
  target: TournamentState;
  bandKeys: string[];
  bandIndex: number;
  pool: number[];
  revealed: WheelPick[];
  rotation: number;
  spinning: boolean;
  pendingRank: number | null;
  finished: boolean;
};
type PendingConfirmation = { title: string; message: string; confirmLabel: string; action: () => void };

const spinPause = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

function polarPoint(angle: number, radius: number) {
  const radians = angle * Math.PI / 180;
  return { x: 180 + radius * Math.cos(radians), y: 180 + radius * Math.sin(radians) };
}

function wheelSectorPath(index: number, count: number) {
  const part = 360 / count;
  const start = -90 + index * part;
  const end = start + part;
  const from = polarPoint(start, 158);
  const to = polarPoint(end, 158);
  const largeArc = part > 180 ? 1 : 0;
  return `M 180 180 L ${from.x} ${from.y} A 158 158 0 ${largeArc} 1 ${to.x} ${to.y} Z`;
}

function wheelName(value: string) {
  return value.length > 15 ? `${value.slice(0, 14)}…` : value;
}

function DrawWheel({ run, teams }: { run: WheelRun; teams: Team[] }) {
  const teamByRank = (rank: number) => teams.find(team => team.rank === rank);
  const group = bands[run.bandKeys[run.bandIndex]];
  const pickedInGroup = new Set(run.revealed.filter(pick => pick.band === run.bandKeys[run.bandIndex]).map(pick => pick.rank));
  const colors = ['#1265b5', '#ffd43b', '#0b3264', '#e8f1fb'];
  const textColors = ['#ffffff', '#09254a', '#ffffff', '#09254a'];
  const count = run.pool.length;
  const currentTeam = run.pendingRank === null ? undefined : teamByRank(run.pendingRank);
  return <div className="wheel-layout">
    <div className="wheel-stage">
      <div className="wheel-pointer" aria-hidden="true" />
      <svg
        className={`draw-wheel ${run.spinning ? 'is-spinning' : ''}`}
        viewBox="0 0 360 360"
        role="img"
        aria-label="Roue de tirage au sort des équipes"
        style={{ transform: `rotate(${run.rotation}deg)` }}
      >
        <circle cx="180" cy="180" r="167" fill="#09254a" stroke="#ffd43b" strokeWidth="5" />
        {run.pool.map((rank, index) => {
          const team = teamByRank(rank);
          const part = 360 / count;
          const angle = -90 + (index + 0.5) * part;
          const labelPoint = polarPoint(angle, count === 2 ? 98 : 108);
          let labelRotation = angle + 90;
          const normal = ((labelRotation % 360) + 360) % 360;
          if (normal > 90 && normal < 270) labelRotation += 180;
          const picked = pickedInGroup.has(rank);
          const isTarget = !run.spinning && run.pendingRank === rank;
          return <g key={rank} opacity={picked ? 0.48 : 1}>
            <path d={wheelSectorPath(index, count)} fill={colors[index % colors.length]} stroke="#ffffff" strokeWidth="2.5" />
            {isTarget && <path d={wheelSectorPath(index, count)} fill="none" stroke="#ffd43b" strokeWidth="6" />}
            <g transform={`rotate(${labelRotation} ${labelPoint.x} ${labelPoint.y})`}>
              <text x={labelPoint.x} y={labelPoint.y - 5} textAnchor="middle" fontSize={count === 2 ? 12 : 10} fontWeight="800" fill={textColors[index % textColors.length]}>{wheelName(team?.player1 ?? `Rang ${rank}`)}</text>
              <text x={labelPoint.x} y={labelPoint.y + 10} textAnchor="middle" fontSize={count === 2 ? 12 : 10} fontWeight="800" fill={textColors[index % textColors.length]}>{wheelName(team?.player2 ?? '')}</text>
            </g>
          </g>;
        })}
        <circle cx="180" cy="180" r="45" fill="#09254a" stroke="#ffd43b" strokeWidth="4" />
        <text x="180" y="175" textAnchor="middle" fontSize="13" fontWeight="900" letterSpacing="1" fill="#ffffff">ZE</text>
        <text x="180" y="192" textAnchor="middle" fontSize="12" fontWeight="900" letterSpacing=".5" fill="#ffd43b">PADEL</text>
      </svg>
    </div>
    <div className="wheel-result-panel" aria-live="polite">
      <span className="wheel-result-eyebrow">{run.spinning ? 'LE TIRAGE EST EN COURS' : run.finished ? 'TIRAGE TERMINÉ' : 'RÉSULTAT DU TIRAGE'}</span>
      {run.spinning ? <strong className="wheel-spinning-label"><span className="wheel-live-dot" />La roue tourne…</strong>
        : currentTeam ? <><strong className="wheel-selected-name">{currentTeam.player1} <span>/</span> {currentTeam.player2}</strong><span className="wheel-selected-rank">Équipe de rang {currentTeam.rank} sélectionnée</span></>
        : <strong>{group ? `Groupe des rangs ${run.bandKeys[run.bandIndex]}` : 'Préparation du tirage…'}</strong>}
      <div className="wheel-progress-track"><span style={{ width: `${Math.min(100, run.revealed.length / run.bandKeys.reduce((sum, band) => sum + (bands[band]?.slots.length ?? 0), 0) * 100)}%` }} /></div>
      <span className="wheel-progress-copy">{run.revealed.length} / {run.bandKeys.reduce((sum, band) => sum + (bands[band]?.slots.length ?? 0), 0)} équipes tirées</span>
    </div>
    {run.revealed.length > 0 && <div className="wheel-revealed-list">
      <div className="wheel-list-heading"><Check size={15} /> Équipes déjà tirées</div>
      <div className="wheel-revealed-grid">
        {run.revealed.map((pick, index) => {
          const team = teamByRank(pick.rank);
          return <div className="wheel-revealed-item" key={`${pick.band}-${pick.slot}-${index}`}>
            <span className="wheel-revealed-number">{index + 1}</span>
            <span className="wheel-revealed-names"><strong>{team?.player1} / {team?.player2}</strong><small>Rangs {pick.band} · emplacement {pick.slot}</small></span>
            <Check size={15} />
          </div>;
        })}
      </div>
    </div>}
  </div>;
}

export function TournamentBoard() {
  const { state, update, busy } = useTournament();
  const [tab, setTab] = useState('main');
  const [drawOpen, setDrawOpen] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirmation | null>(null);
  const [wheelRun, setWheelRun] = useState<WheelRun | null>(null);
  const drawingRef = useRef(false);
  const ready = canDraw(state);
  const registered = state.teams.filter(isTeamComplete).length;
  const complete = Object.keys(state.results).length;
  const drawn = Object.keys(state.draw).length === 16;

  async function beginWheelDraw(bandKeys: string[]) {
    if (drawingRef.current || bandKeys.length === 0) return;
    drawingRef.current = true;
    setDrawOpen(false);
    const target = bandKeys.length === Object.keys(bands).length ? drawAll(state) : drawBand(state, bandKeys[0]!);
    const total = bandKeys.reduce((sum, band) => sum + (bands[band]?.slots.length ?? 0), 0);
    let rotation = 0;
    const revealed: WheelPick[] = [];
    const firstGroup = bands[bandKeys[0]!];
    if (!firstGroup) { drawingRef.current = false; return; }
    setWheelRun({
      target, bandKeys, bandIndex: 0, pool: [...firstGroup.ranks], revealed: [],
      rotation: 0, spinning: false, pendingRank: null, finished: false,
    });
    await spinPause(120);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    for (let groupIndex = 0; groupIndex < bandKeys.length; groupIndex++) {
      const band = bandKeys[groupIndex]!;
      const group = bands[band]!;
      rotation = 0;
      setWheelRun(prev => prev ? { ...prev, bandIndex: groupIndex, pool: [...group.ranks], rotation: 0, spinning: false, pendingRank: null, revealed: [...revealed] } : prev);
      await spinPause(100);
      for (const slotName of group.slots) {
        const rank = target.draw[slotName];
        if (rank === undefined) continue;
        const sectorIndex = group.ranks.indexOf(rank);
        const part = 360 / group.ranks.length;
        const centerAngle = -90 + (sectorIndex + 0.5) * part;
        const delta = (((-90 - centerAngle - (rotation % 360)) % 360) + 360) % 360;
        rotation += (reducedMotion ? 0 : 5 * 360) + delta;
        setWheelRun(prev => prev ? { ...prev, bandIndex: groupIndex, pool: [...group.ranks], rotation, spinning: true, pendingRank: rank, revealed: [...revealed] } : prev);
        await spinPause(reducedMotion ? 100 : 1300);
        revealed.push({ band, slot: slotName, rank });
        setWheelRun(prev => prev ? { ...prev, spinning: false, pendingRank: rank, revealed: [...revealed] } : prev);
        await spinPause(reducedMotion ? 40 : 360);
      }
    }
    setWheelRun(prev => prev ? { ...prev, spinning: false, pendingRank: null, revealed: [...revealed], finished: true } : prev);
  }

  function requestWheelDraw(bandKeys: string[]) {
    const start = () => { setConfirm(null); void beginWheelDraw(bandKeys); };
    if (complete > 0) {
      setConfirm({
        title: 'Relancer le tirage ?',
        message: 'Des résultats sont déjà enregistrés. Relancer le tirage effacera ces résultats et les qualifications correspondantes. La roue affichera les nouvelles affectations avant leur application.',
        confirmLabel: 'Relancer le tirage',
        action: start,
      });
    } else start();
  }

  function requestReset() {
    setConfirm({
      title: 'Réinitialiser le tournoi ?',
      message: 'Cette action efface le tirage, les résultats déjà saisis et les qualifications correspondantes. Les équipes importées seront conservées.',
      confirmLabel: 'Réinitialiser',
      action: () => { update({ ...initialState(), teams: state.teams }); setConfirm(null); },
    });
  }

  function applyWheelDraw() {
    if (!wheelRun?.finished) return;
    update(wheelRun.target);
    setWheelRun(null);
    drawingRef.current = false;
  }

  return <><section className="stats-strip"><div><Users /><span><strong>{registered}<em>/16</em></strong> équipes inscrites</span></div><div><GitBranch /><span><strong>28</strong> matchs au total</span></div><div><CheckCheck /><span><strong>{complete}<em>/28</em></strong> matchs terminés</span></div><div><Trophy /><span><strong>16</strong> places attribuées</span></div></section>
    <section className="board-section"><div className="section-heading"><div><span className="section-eyebrow">LA COMPÉTITION</span><h2>Tableau du tournoi</h2></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" title="Réinitialiser le tirage et les résultats" aria-label="Réinitialiser le tournoi" disabled={busy || !!wheelRun} onClick={requestReset}><RotateCcw /></Button><Button disabled={busy || !ready || !!wheelRun} onClick={() => setDrawOpen(true)}><Shuffle />{drawn ? 'Gérer le tirage' : 'Lancer le tirage'}</Button></div></div>
      {!ready && <p role="status" className="text-sm text-muted-foreground mb-4">Complétez les {16 - registered} paires manquantes dans Équipes avant le tirage.</p>}<div className="board-tabs"><Button variant="ghost" className={tab === 'main' ? 'tab-active' : ''} onClick={() => setTab('main')}><GitBranch />Tableau principal<span>15</span></Button><Button variant="ghost" className={tab === 'placement' ? 'tab-active' : ''} onClick={() => setTab('placement')}><Trophy />Matchs de classement<span>13</span></Button><span className="board-legend"><span className="legend-square" />Tête de série</span></div>
      <div className="bracket-scroll"><div className={`bracket ${tab === 'placement' ? 'placement-bracket' : ''}`}>{(tab === 'main' ? mainGroups : placementGroups).map((group, index) => <section key={group.title} className={`bracket-column bracket-column-${index}`}><header className="round-heading"><span className="round-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{group.title}</h3><small>{'detail' in group ? group.detail : `${group.ids.length} matchs`}</small></div></header><div className="round-matches">{group.ids.map(id => { const match = matches.find(m => m.id === id); return match ? <MatchCard key={id} match={match} /> : null; })}</div></section>)}</div></div>
      <div className="board-bottom"><span><span className="live-dot" />{drawn ? 'Tirage effectué · 16 équipes placées' : 'Têtes de série placées · Tirage en attente'}</span><span>Format D2 · 1 set de 9 jeux · No Ad</span></div>
    </section>
    {drawOpen && <div className="modal-backdrop" onClick={() => setDrawOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="draw-title" onClick={e => e.stopPropagation()}><Button size="icon" variant="ghost" className="modal-close" aria-label="Fermer" onClick={() => setDrawOpen(false)}><X /></Button><span className="modal-eyebrow">ENTRÉE ÉCHELONNÉE</span><h2 id="draw-title">Tirage au sort</h2><div className="draw-seeds"><Trophy size={18} /><span>TS1 et TS2 sont déjà placées.</span></div><div className="draw-groups">{Object.entries(bands).map(([band, group]) => <div key={band}><div><strong>Rangs {band}</strong><small>{group.ranks.length} équipes · {group.slots.every(s => state.draw[s]) ? 'Tiré' : 'À tirer'}</small></div><Button variant="outline" size="sm" disabled={busy || !ready || !!wheelRun} onClick={() => requestWheelDraw([band])}><Shuffle />{group.slots.every(s => state.draw[s]) ? 'Retirer' : 'Tirer'}</Button></div>)}</div><Button className="w-full mt-5" disabled={busy || !ready || !!wheelRun} onClick={() => requestWheelDraw(Object.keys(bands))}><Shuffle />Tirer tous les groupes</Button></section></div>}
    {wheelRun && <div className="modal-backdrop draw-wheel-backdrop"><section className="modal draw-wheel-modal" role="dialog" aria-modal="true" aria-labelledby="wheel-title">
      <div className="wheel-modal-topline"><span className="modal-eyebrow">ZE PADEL · TIRAGE OFFICIEL</span><span className="wheel-counter">ÉTAPE {Math.min(wheelRun.revealed.length + (wheelRun.spinning ? 1 : 0), wheelRun.bandKeys.reduce((sum, band) => sum + (bands[band]?.slots.length ?? 0), 0))} / {wheelRun.bandKeys.reduce((sum, band) => sum + (bands[band]?.slots.length ?? 0), 0)}</span></div>
      <h2 id="wheel-title">{wheelRun.finished ? 'Le tirage est terminé !' : `Rangs ${wheelRun.bandKeys[wheelRun.bandIndex]}`}</h2>
      <p className="wheel-intro">{wheelRun.finished ? 'Toutes les équipes ont été affectées. Vérifie le récapitulatif avant de valider le tirage.' : 'Les noms défilent, la roue ralentit… et le hasard désigne la prochaine équipe.'}</p>
      <DrawWheel run={wheelRun} teams={state.teams} />
      {wheelRun.finished && <div className="wheel-finished-actions"><Button variant="outline" onClick={() => { setWheelRun(null); drawingRef.current = false; }}>Annuler</Button><Button onClick={applyWheelDraw}><Check />Valider et appliquer le tirage</Button></div>}
    </section></div>}
    {confirm && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-action-title"><h2 id="confirm-action-title">{confirm.title}</h2><p className="text-muted-foreground mb-6">{confirm.message}</p><div className="flex gap-3"><Button variant="outline" onClick={() => setConfirm(null)}>Annuler</Button><Button variant="destructive" onClick={confirm.action}>{confirm.confirmLabel}</Button></div></section></div>}
  </>;
}