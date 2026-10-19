import { createFileRoute } from '@tanstack/react-router';
import { Trophy } from 'lucide-react';
import { TournamentShell } from '@/components/padel/tournament-shell';
import { useTournament } from '@/components/padel/use-tournament';
import { points, standings } from '@/lib/padel/tournament';
export const Route = createFileRoute('/classement')({ head: () => ({ meta: [
  { title: 'Classement P100 Ze Padel | Padel Board' }, { name: 'description', content: 'Classement final des 16 équipes et points du tournoi P100 Ze Padel.' },
  { property: 'og:title', content: 'Classement · P100 Ze Padel' }, { property: 'og:description', content: 'Résultats et points du tournoi de padel à 16 équipes.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
] }), component: StandingsPage });
function StandingsPage() {
  const { state } = useTournament(); const rows = standings(state);
  return <TournamentShell><section className="content-section"><div className="section-heading"><div><span className="section-eyebrow">LES RÉSULTATS</span><h2>Classement du tournoi</h2></div><span className="ranking-status">{rows.length}/16 places attribuées</span></div><div className="table-scroll"><table className="teams-table"><thead><tr><th>Place</th><th>Équipe</th><th>Rang initial</th><th>Points P100</th></tr></thead><tbody>{points.map((p, i) => { const row = rows.find(r => r.place === i + 1); return <tr key={i}><td><span className={`table-rank ${i === 0 ? 'seed-rank' : ''}`}>{i === 0 ? <Trophy size={17} /> : String(i + 1).padStart(2, '0')}</span></td><td>{row ? <strong>{row.team.player1} / {row.team.player2}</strong> : <span className="text-muted-foreground">À déterminer</span>}</td><td>{row?.team.rank ?? '—'}</td><td><strong>{p}</strong> <span className="text-muted-foreground">pts</span></td></tr>; })}</tbody></table></div></section></TournamentShell>;
}