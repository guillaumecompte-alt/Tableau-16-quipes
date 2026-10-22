import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTournament } from '@/components/padel/use-tournament';
import { TournamentShell } from '@/components/padel/tournament-shell';
import { isTeamComplete } from '@/lib/padel/tournament';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const TEST_RECIPIENTS = new Set([
  'guillaume.compte@gmail.com',
  'williamdurand84@gmail.com',
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIMULATION_RUN_STORAGE_KEY = 'ze-padel-simulation-run-id-v1';

export const Route = createFileRoute('/convocations')({
  head: () => ({ meta: [{ title: 'ZE PADEL · Convocations' }, { name: 'description', content: 'Préparer les horaires de convocation et vérifier les e-mails des joueurs.' }] }),
  component: ConvocationsPage,
});

function ConvocationsPage() {
  const { state, update, busy, user, dirty, save } = useTournament();
  const complete = state.teams.filter(isTeamComplete);
  const missingEmails = complete.reduce((n, team) => n + Number(!team.email1?.trim()) + Number(!team.email2?.trim()), 0);
  const [sendingTest, setSendingTest] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testError, setTestError] = useState(false);
  const [sendingHotmailTest, setSendingHotmailTest] = useState(false);
  const [hotmailTestMessage, setHotmailTestMessage] = useState('');
  const [hotmailTestError, setHotmailTestError] = useState(false);
  const [sendingSimulation, setSendingSimulation] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState('');
  const [simulationError, setSimulationError] = useState(false);
  const [simulationRunId, setSimulationRunId] = useState<string | null>(null);
  const [showRealPreview, setShowRealPreview] = useState(false);
  const [sendingReal, setSendingReal] = useState(false);
  const [realMessage, setRealMessage] = useState('');
  const [realError, setRealError] = useState(false);

  // Simulation campaigns are sent in bounded batches to respect Worker subrequest limits.
  async function sendSimulationCampaign() {
    const tournamentType = state.info?.tournamentType.trim() ?? '';
    const date = state.info?.date.trim() ?? '';
    const teams = [...state.teams].sort((a, b) => a.rank - b.rank);
    const issues: string[] = [];

    if (!tournamentType) issues.push('Le type du tournoi doit être renseigné.');
    if (!date) issues.push('La date du tournoi doit être renseignée.');
    if (teams.length !== 16) issues.push('Il faut exactement 16 équipes.');

    const ranks = new Set<number>();
    for (const team of teams) {
      if (!Number.isInteger(team.rank) || team.rank < 1 || team.rank > 16 || ranks.has(team.rank)) {
        issues.push('Les rangs doivent être uniques de 1 à 16.');
      }
      ranks.add(team.rank);
      if (!team.player1.trim() || !team.player2.trim()) {
        issues.push(`Paire #${team.rank} : il manque un nom de joueur.`);
      }
      if (!team.time.trim()) {
        issues.push(`Paire #${team.rank} : l’heure de convocation n’est pas renseignée.`);
      }
    }

    if (ranks.size !== 16) issues.push('Les 16 rangs doivent être présents.');
    if (issues.length) {
      setSimulationError(true);
      setSimulationMessage(issues.join('\n'));
      return;
    }

    const confirmed = window.confirm(
      'SIMULATION DE 32 E-MAILS\n\nCela enverra réellement 32 messages marqués SIMULATION : 16 à guillaume.compte@gmail.com (joueur 1 de chaque paire) et 16 à williamdurand84@gmail.com (joueur 2 de chaque paire).\n\nAucun e-mail ne sera envoyé aux adresses enregistrées dans les équipes. Continuer ?'
    );
    if (!confirmed) return;

    setSendingSimulation(true);
    setSimulationError(false);
    setSimulationMessage('Envoi de la simulation en cours… Ne ferme pas cette page.');

    // Persist the campaign ID so closing or refreshing the tab does not lose resume safety.
    // If storage is unavailable, keep the in-memory fallback.
    let storedRunId: string | null = null;
    try {
      storedRunId = window.localStorage.getItem(SIMULATION_RUN_STORAGE_KEY);
    } catch {
      // Browser storage may be disabled; the in-memory fallback still works for this tab.
    }
    const candidateRunId = simulationRunId ?? storedRunId;
    const runId = candidateRunId && /^[A-Za-z0-9_-]{12,100}$/.test(candidateRunId)
      ? candidateRunId
      : crypto.randomUUID();
    setSimulationRunId(runId);
    try {
      window.localStorage.setItem(SIMULATION_RUN_STORAGE_KEY, runId);
    } catch {
      // Continue with the in-memory ID when persistent storage is unavailable.
    }

    try {
      const payload = {
        runId,
        teams: teams.map((team) => ({
          rank: team.rank,
          player1: team.player1,
          player2: team.player2,
          time: team.time,
        })),
        tournament: {
          tournamentType,
          date,
          referee: state.info?.referee ?? '',
        },
      };

      let sentCount = 0;
      let duplicateCount = 0;
      const sendErrors: string[] = [];

      // One email per Worker request avoids redirect subrequest-limit failures.
      // The backend derives a deterministic idempotency key from this campaign.
      for (let messageIndex = 0; messageIndex < 32; messageIndex += 1) {
        setSimulationMessage(
          `Simulation en cours : message ${messageIndex + 1}/32. ${sentCount} nouveaux e-mails acceptés, ${duplicateCount} déjà traités…`
        );
        try {
          const response = await fetch('/api/simulate-convocations', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...payload, messageIndex }),
          });
          let result: {
            ok?: boolean;
            sentCount?: number;
            duplicateCount?: number;
            message?: string;
            issues?: string[];
          } = {};
          try {
            result = await response.json() as typeof result;
          } catch {
            sendErrors.push(`Message ${messageIndex + 1}/32 : réponse serveur inattendue.`);
            continue;
          }

          sentCount += result.sentCount ?? 0;
          duplicateCount += result.duplicateCount ?? 0;
          if (!response.ok || !result.ok) {
            sendErrors.push(result.message || `Échec du message ${messageIndex + 1}/32.`);
            sendErrors.push(...(result.issues ?? []));
          }
        } catch (error) {
          sendErrors.push(
            `Message ${messageIndex + 1}/32 : ${error instanceof Error ? error.message : 'erreur réseau'}`
          );
        }
      }

      if (sendErrors.length > 0) {
        setSimulationMessage(
          `Simulation partielle : ${sentCount} nouveaux e-mails acceptés, ${duplicateCount} déjà traités.\n${sendErrors.join('\n')}`
        );
        setSimulationError(true);
      } else {
        setSimulationMessage(
          `Simulation terminée : ${sentCount} nouveaux e-mails acceptés, ${duplicateCount} déjà traités. Vérifie les deux boîtes de réception et les courriers indésirables.`
        );
        setSimulationError(false);
        setSimulationRunId(null);
        try {
          if (window.localStorage.getItem(SIMULATION_RUN_STORAGE_KEY) === runId) {
            window.localStorage.removeItem(SIMULATION_RUN_STORAGE_KEY);
          }
        } catch {
          // A stale ID in storage is harmless; the next successful run can replace it.
        }
      }
    } catch (error) {
      setSimulationMessage(error instanceof Error ? error.message : 'Impossible de terminer la simulation.');
      setSimulationError(true);
    } finally {
      setSendingSimulation(false);
    }
  }

  function realEmailIssues(): string[] {
    const issues: string[] = [];
    if (!state.info?.tournamentType.trim()) issues.push('Le type du tournoi doit être renseigné.');
    if (!state.info?.date.trim()) issues.push('La date du tournoi doit être renseignée.');
    if (state.teams.length !== 16) issues.push('Le tournoi doit contenir exactement 16 équipes.');
    const ranks = new Set<number>();
    const emails = new Set<string>();

    for (const team of state.teams) {
      if (!Number.isInteger(team.rank) || team.rank < 1 || team.rank > 16 || ranks.has(team.rank)) {
        issues.push('Les rangs des équipes doivent être uniques de 1 à 16.');
      }
      ranks.add(team.rank);
      if (!isTeamComplete(team)) issues.push(`Paire #${team.rank} : noms ou classements des joueurs incomplets.`);
      if (!team.time.trim()) issues.push(`Paire #${team.rank} : heure de convocation manquante.`);

      for (const [rawEmail, playerLabel] of [
        [team.email1, 'joueur 1'],
        [team.email2, 'joueur 2'],
      ] as const) {
        const email = (rawEmail ?? '').trim().toLowerCase();
        if (!EMAIL_RE.test(email) || email.length > 254) {
          issues.push(`Paire #${team.rank} : adresse e-mail du ${playerLabel} absente ou invalide.`);
          continue;
        }
        if (TEST_RECIPIENTS.has(email)) {
          issues.push(`Adresse de test encore utilisée : ${email} (paire #${team.rank}).`);
          continue;
        }
        if (emails.has(email)) {
          issues.push(`Adresse e-mail utilisée plusieurs fois : ${email}.`);
          continue;
        }
        emails.add(email);
      }
    }
    if (ranks.size !== 16) issues.push('Il faut les 16 rangs du tableau.');
    if (emails.size !== 32) issues.push(`Il faut 32 adresses e-mail distinctes (actuellement ${emails.size} adresse(s) valide(s)).`);
    return Array.from(new Set(issues));
  }

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
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          team: { rank: team.rank, player1: team.player1, player2: team.player2, time: team.time },
          tournament: {
            tournamentType: state.info?.tournamentType ?? '',
            date: state.info?.date ?? '',
            referee: state.info?.referee ?? '',
          },
        }),
      });
      let result: { ok?: boolean; error?: string; sentTo?: string[]; message?: string } = {};
      try { result = await response.json() as typeof result; }
      catch { throw new Error('Le serveur a retourné une réponse inattendue.'); }
      if (!response.ok || !result.ok) throw new Error(result.message || 'L’envoi de test a échoué.');
      setTestMessage(`Test confirmé pour : ${(result.sentTo ?? []).join(' et ')}. Vérifie aussi le dossier Spam.`);
      setTestError(false);
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : 'Impossible d’envoyer les e-mails de test.');
      setTestError(true);
    } finally { setSendingTest(false); }
  }

  async function sendHotmailTest() {
    const team = state.teams.find((entry) => entry.rank === 1);
    if (!team || !team.player1.trim() || !team.player2.trim()) {
      setHotmailTestError(true);
      setHotmailTestMessage('La paire de rang 1 doit contenir deux noms de joueurs.');
      return;
    }

    const confirmed = window.confirm(
      'TEST UNIQUE — envoyer un seul e-mail marqué TEST à guigui99999@hotmail.com ? Aucun e-mail ne sera envoyé aux adresses des joueurs.'
    );
    if (!confirmed) return;

    setSendingHotmailTest(true);
    setHotmailTestError(false);
    setHotmailTestMessage('Envoi du test unique vers Hotmail en cours…');
    try {
      const response = await fetch('/api/test-hotmail', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
      let result: { ok?: boolean; message?: string } = {};
      try {
        result = await response.json() as typeof result;
      } catch {
        throw new Error('Le serveur a retourné une réponse inattendue.');
      }
      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Le test vers Hotmail a échoué.');
      }
      setHotmailTestMessage(result.message || 'Le relais a accepté un e-mail pour Hotmail. Vérifie la boîte et les indésirables.');
      setHotmailTestError(false);
    } catch (error) {
      setHotmailTestMessage(error instanceof Error ? error.message : 'Impossible d’envoyer le test vers Hotmail.');
      setHotmailTestError(true);
    } finally {
      setSendingHotmailTest(false);
    }
  }

  function prepareRealPreview() {
    setShowRealPreview(true);
    setRealMessage('');
    setRealError(false);
    if (!user) {
      setRealError(true);
      setRealMessage('Connecte-toi avec le compte expéditeur autorisé pour préparer un envoi réel.');
      return;
    }
    if (dirty) {
      setRealError(true);
      setRealMessage('Les modifications ne sont pas encore enregistrées en ligne. Clique sur « Enregistrer en ligne », puis recommence.');
      return;
    }
    const issues = realEmailIssues();
    if (issues.length) {
      setRealError(true);
      setRealMessage(issues.join('\n'));
      return;
    }
    setRealMessage('Vérification locale réussie : 32 destinataires uniques. Aucun e-mail n’a été envoyé. Vérifie la liste puis confirme séparément pour lancer la campagne.');
  }

  async function sendRealConvocations() {
    if (!user) {
      setRealError(true);
      setRealMessage('Connecte-toi avec le compte expéditeur autorisé.');
      return;
    }
    if (dirty) {
      setRealError(true);
      setRealMessage('Enregistre d’abord les modifications en ligne avant l’envoi réel.');
      return;
    }
    const issues = realEmailIssues();
    if (issues.length) {
      setRealError(true);
      setRealMessage(issues.join('\n'));
      return;
    }
    const confirmed = window.confirm(
      'CONFIRMATION FINALE : envoyer maintenant 32 e-mails réels, un à chaque joueur, aux adresses affichées dans ZE PADEL ? Cette action ne peut pas être annulée.'
    );
    if (!confirmed) return;

    setSendingReal(true);
    setRealError(false);
    setRealMessage('Contrôle de sécurité et envoi en cours…');
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (sessionError || !accessToken) throw new Error('Ta session a expiré. Reconnecte-toi.');
      const response = await fetch('/api/send-convocations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          teams: state.teams.map((team) => ({
            rank: team.rank,
            player1: team.player1,
            player2: team.player2,
            email1: team.email1,
            email2: team.email2,
            time: team.time,
          })),
          info: {
            tournamentType: state.info?.tournamentType ?? '',
            date: state.info?.date ?? '',
            referee: state.info?.referee ?? '',
          },
        }),
      });
      let result: {
        ok?: boolean; error?: string; sentCount?: number; duplicateCount?: number;
        message?: string; issues?: string[];
      } = {};
      try { result = await response.json() as typeof result; }
      catch { throw new Error('Le serveur a retourné une réponse inattendue.'); }
      if (!response.ok || !result.ok) {
        const detail = result.issues?.length ? '\n' + result.issues.join('\n') : '';
        throw new Error((result.message || 'L’envoi réel est bloqué.') + detail);
      }
      setRealMessage(result.message || `Envoi confirmé : ${result.sentCount ?? 0} e-mails acceptés par Gmail.`);
      setRealError(false);
    } catch (error) {
      setRealMessage(error instanceof Error ? error.message : 'Impossible de terminer l’envoi réel.');
      setRealError(true);
    } finally { setSendingReal(false); }
  }

  return <TournamentShell>
    <section className="content-section">
      <div className="section-heading"><div><span className="section-eyebrow">ORGANISATION DU TOURNOI</span><h2>Convocations</h2></div></div>
      <p className="text-sm text-muted-foreground mb-4">Saisis l’heure de convocation pour chaque paire. Les adresses e-mail importées depuis Excel sont affichées ici et peuvent être corrigées. Les changements suivent la sauvegarde habituelle du tournoi.</p>
      {!user && <p className="import-warning" role="status">Mode local : les données restent sur cet appareil. Le test Gmail reste possible. Pour l’envoi réel, il faudra se connecter avec le compte expéditeur autorisé et enregistrer le tournoi en ligne.</p>}
      <p className="text-sm text-muted-foreground mb-4">{complete.length}/16 paires complètes · {missingEmails} adresse(s) e-mail manquante(s).</p>

      <div className="mb-6 rounded-lg border p-4">
        <h3 className="font-semibold">Tester l’envoi Gmail</h3>
        <p className="text-sm text-muted-foreground mt-2 mb-3">En mode test, un clic envoie un e-mail marqué « TEST » aux deux adresses de test autorisées. Les adresses des joueurs du tournoi ne sont pas utilisées. Le message reprend les informations de la paire de rang 1.</p>
        <Button type="button" onClick={() => void sendTestConvocation()} disabled={busy || sendingTest}>
          {sendingTest ? 'Envoi en cours…' : 'Envoyer les 2 e-mails de test'}
        </Button>
        {testMessage && <p className={`text-sm mt-3 ${testError ? 'text-destructive' : 'text-muted-foreground'}`} role="status">{testMessage}</p>}
        <div className="mt-4 border-t pt-4">
          <p className="text-sm text-muted-foreground mb-3">Test isolé d’une troisième boîte : envoie un seul e-mail marqué « TEST » à guigui99999@hotmail.com. Ce test ne participe pas à la simulation des 32 messages.</p>
          <Button type="button" variant="outline" onClick={() => void sendHotmailTest()} disabled={busy || sendingHotmailTest}>
            {sendingHotmailTest ? 'Test Hotmail en cours…' : 'Tester une seule réception sur Hotmail'}
          </Button>
          {hotmailTestMessage && <p className={`text-sm whitespace-pre-line mt-3 ${hotmailTestError ? 'text-destructive' : 'text-muted-foreground'}`} role="status">{hotmailTestMessage}</p>}
        </div>
      </div>

      <div className="mb-6 rounded-lg border p-4">
        <h3 className="font-semibold">Simulation complète de la campagne (32 e-mails)</h3>
        <p className="text-sm text-muted-foreground mt-2 mb-3">Envoie 32 messages réels marqués « SIMULATION », uniquement aux deux boîtes de test : 16 à guillaume.compte@gmail.com pour les joueurs 1 et 16 à williamdurand84@gmail.com pour les joueurs 2. Les adresses e-mail enregistrées dans les équipes sont ignorées. Vérifie le type, la date, les noms et les heures avant de commencer.</p>
        <Button type="button" variant="outline" onClick={() => void sendSimulationCampaign()} disabled={busy || sendingSimulation}>
          {sendingSimulation ? 'Simulation en cours…' : 'Envoyer les 32 e-mails de simulation'}
        </Button>
        {simulationMessage && <p className={`text-sm whitespace-pre-line mt-3 ${simulationError ? 'text-destructive' : 'text-muted-foreground'}`} role="status">{simulationMessage}</p>}
      </div>

      <div className="mb-6 rounded-lg border p-4">
        <h3 className="font-semibold">Envoyer les convocations aux joueurs</h3>
        <p className="text-sm text-muted-foreground mt-2 mb-3">Avant tout envoi, ZE PADEL vérifie les 16 paires, la date du tournoi, les 32 adresses distinctes et bloque les adresses de test. L’envoi réel nécessite une connexion autorisée, la sauvegarde en ligne et une confirmation finale.</p>
        <Button type="button" variant="outline" onClick={prepareRealPreview} disabled={busy || sendingReal}>
          Vérifier les destinataires
        </Button>
        {showRealPreview && <div className="mt-4 rounded-md bg-muted/40 p-3">
          <p className="text-sm font-medium mb-2">Contrôle avant envoi</p>
          <p className={`text-sm whitespace-pre-line ${realError ? 'text-destructive' : 'text-muted-foreground'}`} role="status">{realMessage}</p>
          {!realError && <Button type="button" className="mt-3" onClick={() => void sendRealConvocations()} disabled={busy || sendingReal}>
            {sendingReal ? 'Envoi en cours…' : 'Confirmer et envoyer les 32 convocations'}
          </Button>}
        </div>}
      </div>

      <div className="table-scroll"><table className="teams-table"><thead><tr><th>Rang</th><th>Joueurs</th><th>E-mail joueur 1</th><th>E-mail joueur 2</th><th>Heure de convocation</th></tr></thead>
      <tbody>{state.teams.map(team => <tr key={team.rank}>
        <td>{team.rank}</td><td><strong>{team.player1 || 'Joueur 1 à renseigner'} / {team.player2 || 'Joueur 2 à renseigner'}</strong></td>
        <td><input aria-label={`E-mail joueur 1, paire ${team.rank}`} type="email" value={team.email1 ?? ''} onChange={e => { update({ ...state, teams: state.teams.map(t => t.rank === team.rank ? { ...t, email1: e.target.value } : t) }); setShowRealPreview(false); setRealMessage(''); }} disabled={busy} placeholder="joueur1@exemple.fr" /></td>
        <td><input aria-label={`E-mail joueur 2, paire ${team.rank}`} type="email" value={team.email2 ?? ''} onChange={e => { update({ ...state, teams: state.teams.map(t => t.rank === team.rank ? { ...t, email2: e.target.value } : t) }); setShowRealPreview(false); setRealMessage(''); }} disabled={busy} placeholder="joueur2@exemple.fr" /></td>
        <td><input aria-label={`Heure de convocation, paire ${team.rank}`} value={team.time} onChange={e => { update({ ...state, teams: state.teams.map(t => t.rank === team.rank ? { ...t, time: e.target.value } : t) }); setShowRealPreview(false); setRealMessage(''); }} disabled={busy} placeholder="Ex. 09:30" /></td>
      </tr>)}</tbody></table></div>
    </section>
  </TournamentShell>;
}
