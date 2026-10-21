import { createFileRoute } from '@tanstack/react-router';
import { useTournament } from '@/components/padel/use-tournament';
import { TournamentShell } from '@/components/padel/tournament-shell';
import { isTeamComplete } from '@/lib/padel/tournament';

export const Route = createFileRoute('/convocations')({
  head: () => ({ meta: [{ title: 'ZE PADEL · Convocations' }, { name: 'description', content: 'Préparer les horaires de convocation et vérifier les e-mails des joueurs.' }] }),
  component: ConvocationsPage,
});

function ConvocationsPage() {
  const { state, update, busy, user } = useTournament();
  const complete = state.teams.filter(isTeamComplete);
  const missingEmails = complete.reduce((n, team) => n + Number(!team.email1?.trim()) + Number(!team.email2?.trim()), 0);
  return <TournamentShell>
    <section className="content-section">
      <div className="section-heading"><div><span className="section-eyebrow">ORGANISATION DU TOURNOI</span><h2>Convocations</h2></div></div>
      <p className="text-sm text-muted-foreground mb-4">Saisis l’heure de convocation pour chaque paire. Les adresses e-mail importées depuis Excel sont affichées ici et peuvent être corrigées. Les changements suivent la sauvegarde habituelle du tournoi.</p>
      {!user && <p className="import-warning" role="status">Mode local : les données restent sur cet appareil. Connecte-toi et enregistre le tournoi en ligne pour préparer une future campagne d’e-mails.</p>}
      <p className="text-sm text-muted-foreground mb-4">{complete.length}/16 paires complètes · {missingEmails} adresse(s) e-mail manquante(s).</p>
      <div className="table-scroll"><table className="teams-table"><thead><tr><th>Rang</th><th>Joueurs</th><th>E-mail joueur 1</th><th>E-mail joueur 2</th><th>Heure de convocation</th></tr></thead>
      <tbody>{state.teams.map(team => <tr key={team.rank}>
        <td>{team.rank}</td><td><strong>{team.player1 || 'Joueur 1 à renseigner'} / {team.player2 || 'Joueur 2 à renseigner'}</strong></td>
        <td><input aria-label={`E-mail joueur 1, paire ${team.rank}`} type="email" value={team.email1 ?? ''} onChange={e => update({ ...state, teams: state.teams.map(t => t.rank === team.rank ? { ...t, email1: e.target.value } : t) })} disabled={busy} placeholder="joueur1@exemple.fr" /></td>
        <td><input aria-label={`E-mail joueur 2, paire ${team.rank}`} type="email" value={team.email2 ?? ''} onChange={e => update({ ...state, teams: state.teams.map(t => t.rank === team.rank ? { ...t, email2: e.target.value } : t) })} disabled={busy} placeholder="joueur2@exemple.fr" /></td>
        <td><input aria-label={`Heure de convocation, paire ${team.rank}`} value={team.time} onChange={e => update({ ...state, teams: state.teams.map(t => t.rank === team.rank ? { ...t, time: e.target.value } : t) })} disabled={busy} placeholder="Ex. 09:30" /></td>
      </tr>)}</tbody></table></div>
      <div className="mt-5"><h3 className="font-semibold">Envoi des convocations</h3><p className="text-sm text-muted-foreground mt-2">L’envoi est volontairement désactivé à cette étape. Aucun e-mail ne sera envoyé. Il reste à configurer le fournisseur d’e-mail côté serveur, les secrets et la journalisation sécurisée avant d’activer l’envoi réel.</p></div>
    </section>
  </TournamentShell>;
}
