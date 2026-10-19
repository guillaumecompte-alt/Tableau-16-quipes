import { useState } from 'react';
import { Check, Pencil, X, Trophy, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveSource, setResult, type Match, type Source, type Result } from '@/lib/padel/tournament';
import { useTournament } from './use-tournament';

export function MatchCard({ match }: { match: Match }) {
  const { state, update, busy } = useTournament(); const [open, setOpen] = useState(false);
  const top = resolveSource(state, match.entries[0]); const bottom = resolveSource(state, match.entries[1]);
  const result = state.results[match.id]; const ready = Boolean(top && bottom);
  const placeholder = (s: Source) => 'slot' in s ? s.band ? `Tirage · rangs ${s.band}` : 'Tête de série' : `${s.outcome === 'winner' ? 'Vainqueur' : 'Perdant'} match ${s.match}`;
  function decide(r: Result) { update(setResult(state, match.id, r)); setOpen(false); }
  return <><article className={`match-card ${result !== undefined ? 'match-complete' : ''} ${match.id === 28 ? 'final-card' : ''}`} data-match={match.id}>
    <header><span>{match.id === 28 ? <Trophy size={12} /> : null} MATCH {String(match.id).padStart(2, '0')}</span><Button size="icon" variant="ghost" className="match-edit" disabled={!ready || busy} title={`Résultat du match ${match.id}`} aria-label={`Résultat du match ${match.id}`} onClick={() => setOpen(true)}>{result !== undefined ? <Check /> : <Pencil />}</Button></header>
    {[top, bottom].map((team, i) => <div className={`match-team ${team ? '' : 'match-empty'} ${result === (i === 0 ? 1 : 0) ? 'match-winner' : ''}`} key={i}><span className={`team-rank ${team && team.rank <= 2 ? 'seed-rank' : ''}`}>{team ? team.rank : '—'}</span><span className="team-name">{team ? `${team.player1} / ${team.player2}` : placeholder(match.entries[i] ?? match.entries[0])}</span>{result === (i === 0 ? 1 : 0) && <Check size={13} />}</div>)}
    <footer><span>{result !== undefined ? 'Terminé' : ready ? 'À jouer' : 'En attente'}</span><span>{match.places ? `Places ${match.places[0]}–${match.places[1]}` : 'D2 · 9 jeux'}</span></footer>
  </article>{open && <div className="modal-backdrop" onClick={() => setOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby={`result-title-${match.id}`} onClick={e => e.stopPropagation()}><Button size="icon" variant="ghost" className="modal-close" aria-label="Fermer" onClick={() => setOpen(false)}><X /></Button><span className="modal-eyebrow">{match.round} · MATCH {match.id}</span><h2 id={`result-title-${match.id}`}>Résultat du match</h2><div className="result-choices"><Button variant="outline" disabled={busy} onClick={() => decide(1)}><span className="result-code">1</span><span>{top?.player1} / {top?.player2}<small>Victoire de l’équipe du haut</small></span><Trophy /></Button><Button variant="outline" disabled={busy} onClick={() => decide(0)}><span className="result-code">0</span><span>{bottom?.player1} / {bottom?.player2}<small>Victoire de l’équipe du bas</small></span><Trophy /></Button></div>{result !== undefined && <Button variant="ghost" className="mt-4" onClick={() => { update(setResult(state, match.id, undefined)); setOpen(false); }}><Undo2 />Effacer le résultat</Button>}</section></div>}</>;
}