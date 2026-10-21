import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTournament } from '@/components/padel/use-tournament';
import { TournamentShell } from '@/components/padel/tournament-shell';
import { isTeamComplete } from '@/lib/padel/tournament';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/convocations')({
  head: () => ({ meta: [{ title: 'ZE PADEL · Convocations' }, { name: 'description', content: 'Préparer les horaires de convocation et vérifier les e-mails des joueurs.' }] }),
  component: ConvocationsPage,
});

function ConvocationsPage() {
  const { state, update, busy, user } = useTournament();
  const complete = state.teams.filter(isTeamComplete);
  const missingEmails = complete.reduce((n, team) => n + Number(!team.email1?.trim()) + Number(!team.email2?.trim()), 0);
  const [sendingTest, setSendingTest] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testError, setTestError] = useState(false);

  async function sendTestConvocation() {
    const team = state.teams.find((entry) => entry.rank === 1);
    if (!team || !team.player1.trim() || !team.player2.trim()) {
      setTestError(true);
      setTestMessage('La paire de rang 1 doit contenir deux noms de joueurs.');
      return;
    }

    setSendingTest(true);
    setTestError(false);
    setTestMessage('Envoi des deux e-mails de test en cours…');

    try {
      const response = await fetch('/api/test-convocation', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          team: {
            rank: team.rank,
            player1: team.player1,
            player2: team.player2,
            time: team.time,
          },
          tournament: {
            tournamentType: state.info?.tournamentType ?? '',
            date: state.info?.date ?? '',
            referee: state.info?.referee ?? '',
          },
        }),
      });

      let result: {
        ok?: boolean;
        error?: string;
        sentTo?: string[];
        message?: string;
      } = {};
      try {
        result = await response.json() as typeof result;
      } catch {
        throw new Error('Le serveur a retourné une réponse inattendue.');
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'L’envoi de test a échoué.');
      }

      setTestMessage(`Test confirmé pour : ${(result.sentTo ?? []).join(' et ')}. Vérifie aussi le dossier Spam.`);
      setTestError(false);
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : 'Impossible d’envoyer les e-mails de test.');
      setTestError(true);
    } finally {
      setSendingTest(false);
    }
  }

  return <TournamentShell>
    <section className="content-section">
      <div className="section-heading"><div><span className="section-eyebrow">ORGANISATION DU TOURNOI</span><h2>Convocations</h2></div></div>
      <p className="text-sm text-muted-foreground mb-4">Saisis l’heure de convocation pour chaque paire. Les adresses e-mail importées depuis Excel sont affichées ici et peuvent être corrigées. Les changements suivent la sauvegarde habituelle du tournoi.</p>
      {!user && <p className="import-warning" role="status">Mode local : les données restent sur cet appareil. Connecte-toi et enregistre le tournoi en ligne pour préparer une future campagne d’e-mails.</p>}
      <p className="text-sm text-muted-foreground mb-4">{complete.length}/16 paires complètes · {missingEmails} adresse(s) e-mail manquante(s).</p>

      <div className="mb-6 rounded-lg border p-4">
        <h3 className="font-semibold">Tester l’envoi Gmail</h3>
        <p className="text-sm text-muted-foreground mt-2 mb-3">En mode test, un clic envoie un e-mail marqué « TEST » aux deux adresses de test autorisées, même si le tournoi est en mode local. Les adresses des joueurs du tournoi ne sont pas utilisées. Le message reprend les informations de la paire de rang 1.</p>
        <Button type="button" onClick={() => void sendTestConvocation()} disabled={busy || sendingTest}>
          {sendingTest ? 'Envoi en cours…' : 'Envoyer les 2 e-mails de test'}
        </Button>
        {testMessage && <p className={`text-sm mt-3 ${testError ? 'text-destructive' : 'text-muted-foreground'}`} role="status">{testMessage}</p>}
      </div>

      <div className="table-scroll"><table className="teams-table"><thead><tr><th>Rang</th><th>Joueurs</th><th>E-mail joueur 1</th><th>E-mail joueur 2</th><th>Heure de convocation</th></tr></thead>
      <tbody>{state.teams.map(team => <tr key={team.rank}>
        <td>{team.rank}</td><td><strong>{team.player1 || 'Joueur 1 à renseigner'} / {team.player2 || 'Joueur 2 à renseigner'}</strong></td>
        <td><input aria-label={`E-mail joueur 1, paire ${team.rank}`} type="email" value={team.email1 ?? ''} onChange={e => update({ ...state, teams: state.teams.map(t => t.rank === team.rank ? { ...t, email1: e.target.value } : t) })} disabled={busy} placeholder="joueur1@exemple.fr" /></td>
        <td><input aria-label={`E-mail joueur 2, paire ${team.rank}`} type="email" value={team.email2 ?? ''} onChange={e => update({ ...state, teams: state.teams.map(t => t.rank === team.rank ? { ...t, email2: e.target.value } : t) })} disabled={busy} placeholder="joueur2@exemple.fr" /></td>
        <td><input aria-label={`Heure de convocation, paire ${team.rank}`} value={team.time} onChange={e => update({ ...state, teams: state.teams.map(t => t.rank === team.rank ? { ...t, time: e.target.value } : t) })} disabled={busy} placeholder="Ex. 09:30" /></td>
      </tr>)}</tbody></table></div>
    </section>
  </TournamentShell>;
}
