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

const REAL_SEND_HISTORY_STORAGE_KEY = 'ze-padel-real-send-history-v1';

type RealSendKind = 'initial' | 'update';
type RealSentRecord = {
  signature: string;
  sentAt: string;
  rank: number;
  time: string;
  player: string;
  partner: string;
};
type RealPendingRecord = {
  signature: string;
  requestId: string;
  kind: RealSendKind;
  rank: number;
  time: string;
  player: string;
  partner: string;
};
type RealDeliveryHistory = {
  version: 1;
  sent: Record<string, RealSentRecord>;
  pending: Record<string, RealPendingRecord>;
};
type PlannedRealRecipient = {
  email: string;
  signature: string;
  requestId: string;
  kind: RealSendKind;
  rank: number;
  time: string;
  player: string;
  partner: string;
  previousTime?: string;
};
type RealSendPlan = {
  items: PlannedRealRecipient[];
  unchangedCount: number;
  initialCount: number;
  updateCount: number;
  totalCount: number;
};

function readRealDeliveryHistory(): RealDeliveryHistory | null {
  try {
    const raw = window.localStorage.getItem(REAL_SEND_HISTORY_STORAGE_KEY);
    if (!raw) return { version: 1, sent: {}, pending: {} };
    const parsed = JSON.parse(raw) as Partial<RealDeliveryHistory>;
    if (parsed.version !== 1 || !parsed.sent || typeof parsed.sent !== 'object' ||
        !parsed.pending || typeof parsed.pending !== 'object') return null;
    return { version: 1, sent: parsed.sent, pending: parsed.pending };
  } catch {
    return null;
  }
}

function writeRealDeliveryHistory(history: RealDeliveryHistory): boolean {
  try {
    window.localStorage.setItem(REAL_SEND_HISTORY_STORAGE_KEY, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}

function realRecipientSignature(input: {
  tournamentType: string;
  date: string;
  referee: string;
  rank: number;
  player: string;
  partner: string;
  email: string;
  time: string;
}): string {
  return JSON.stringify({
    tournamentType: input.tournamentType.trim(),
    date: input.date.trim(),
    referee: input.referee.trim(),
    rank: input.rank,
    player: input.player.trim(),
    partner: input.partner.trim(),
    email: input.email.trim().toLowerCase(),
    time: input.time.trim(),
  });
}

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
  const [realPlan, setRealPlan] = useState<RealSendPlan | null>(null);

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

  function createRealSendPlan():
    | { ok: true; history: RealDeliveryHistory; plan: RealSendPlan }
    | { ok: false; message: string } {
    const history = readRealDeliveryHistory();
    if (!history) {
      return {
        ok: false,
        message: 'Le suivi d’envoi local est inaccessible ou illisible. Ne lance pas d’envoi avant d’avoir vérifié le stockage du navigateur.',
      };
    }

    const tournamentType = state.info?.tournamentType.trim() ?? '';
    const date = state.info?.date.trim() ?? '';
    const referee = state.info?.referee.trim() ?? '';
    const items: PlannedRealRecipient[] = [];
    let unchangedCount = 0;

    for (const team of [...state.teams].sort((a, b) => a.rank - b.rank)) {
      const players = [
        { player: team.player1.trim(), partner: team.player2.trim(), email: (team.email1 ?? '').trim().toLowerCase() },
        { player: team.player2.trim(), partner: team.player1.trim(), email: (team.email2 ?? '').trim().toLowerCase() },
      ];
      for (const person of players) {
        const signature = realRecipientSignature({
          tournamentType, date, referee, rank: team.rank,
          player: person.player, partner: person.partner, email: person.email, time: team.time,
        });
        const sentRecord = history.sent[person.email];

        if (sentRecord?.signature === signature) {
          delete history.pending[person.email];
          unchangedCount += 1;
          continue;
        }

        let pendingRecord = history.pending[person.email];
        if (!pendingRecord || pendingRecord.signature !== signature) {
          pendingRecord = {
            signature,
            requestId: crypto.randomUUID(),
            kind: sentRecord ? 'update' : 'initial',
            rank: team.rank,
            time: team.time.trim(),
            player: person.player,
            partner: person.partner,
          };
          history.pending[person.email] = pendingRecord;
        }

        items.push({
          email: person.email,
          signature,
          requestId: pendingRecord.requestId,
          kind: pendingRecord.kind,
          rank: team.rank,
          time: team.time.trim(),
          player: person.player,
          partner: person.partner,
          previousTime: sentRecord?.time,
        });
      }
    }

    if (!writeRealDeliveryHistory(history)) {
      return {
        ok: false,
        message: 'Impossible de sauvegarder le suivi d’envoi dans ce navigateur. Pour éviter les doublons, aucun e-mail ne sera envoyé.',
      };
    }

    return {
      ok: true,
      history,
      plan: {
        items,
        unchangedCount,
        initialCount: items.filter((item) => item.kind === 'initial').length,
        updateCount: items.filter((item) => item.kind === 'update').length,
        totalCount: 32,
      },
    };
  }

  function prepareRealPreview() {
    setShowRealPreview(true);
    setRealPlan(null);
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

    const created = createRealSendPlan();
    if (!created.ok) {
      setRealError(true);
      setRealMessage(created.message);
      return;
    }

    setRealPlan(created.plan);
    if (created.plan.items.length === 0) {
      setRealMessage('Aucune convocation à envoyer : les 32 destinataires correspondent déjà aux dernières convocations confirmées. Aucun e-mail n’a été envoyé.');
    } else {
      setRealMessage(
        `Préparation terminée : ${created.plan.items.length} e-mail(s) à envoyer — ${created.plan.initialCount} première(s) convocation(s), ${created.plan.updateCount} mise(s) à jour. ${created.plan.unchangedCount} destinataire(s) sont déjà à jour. Aucun e-mail n’a encore été envoyé.`
      );
    }
  }

  function resetRealDeliveryHistory() {
    const confirmed = window.confirm(
      'Réinitialiser le suivi local des convocations ? À utiliser uniquement pour démarrer un nouveau tournoi. La prochaine vérification considérera les destinataires actuels comme n’ayant jamais reçu de convocation et pourra donc préparer jusqu’à 32 nouveaux e-mails.'
    );
    if (!confirmed) return;
    try {
      window.localStorage.removeItem(REAL_SEND_HISTORY_STORAGE_KEY);
      setRealPlan(null);
      setShowRealPreview(true);
      setRealError(false);
      setRealMessage('Suivi réinitialisé dans ce navigateur. Vérifie les destinataires pour préparer la première campagne du nouveau tournoi. Aucun e-mail n’a été envoyé.');
    } catch {
      setRealError(true);
      setRealMessage('Impossible de réinitialiser le suivi dans le navigateur. Aucun e-mail n’a été envoyé.');
    }
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

    const created = createRealSendPlan();
    if (!created.ok) {
      setRealError(true);
      setRealMessage(created.message);
      return;
    }
    const { plan } = created;
    setRealPlan(plan);
    if (plan.items.length === 0) {
      setRealError(false);
      setRealMessage('Aucun envoi nécessaire : tous les destinataires sont déjà à jour. Aucun e-mail n’a été envoyé.');
      return;
    }

    const confirmed = window.confirm(
      `CONFIRMATION FINALE : envoyer ${plan.items.length} e-mail(s) aux joueurs ? ${plan.initialCount} première(s) convocation(s), ${plan.updateCount} mise(s) à jour ; ${plan.unchangedCount} destinataire(s) ne recevront rien car leur convocation est inchangée. Les messages seront envoyés un par un et suivis individuellement.`
    );
    if (!confirmed) return;

    setSendingReal(true);
    setRealError(false);
    let sentInitial = 0;
    let sentUpdates = 0;
    let duplicateCount = 0;
    let confirmedCount = 0;
    const errors: string[] = [];

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (sessionError || !accessToken) throw new Error('Ta session a expiré. Reconnecte-toi.');

      for (let index = 0; index < plan.items.length; index += 1) {
        const item = plan.items[index];
        if (!item) continue;
        setRealMessage(`Envoi ${index + 1}/${plan.items.length} — paire #${item.rank}, ${item.email}…`);

        let response: Response;
        let result: {
          ok?: boolean;
          error?: string;
          status?: string;
          sentCount?: number;
          duplicateCount?: number;
          sentEmails?: string[];
          duplicateEmails?: string[];
          failedEmails?: string[];
          message?: string;
          issues?: string[];
        } = {};

        try {
          response = await fetch('/api/send-convocations', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              targetEmail: item.email,
              requestId: item.requestId,
              sendKind: item.kind,
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
          try {
            result = await response.json() as typeof result;
          } catch {
            errors.push(`${item.email} : réponse serveur inattendue. La tentative reste en attente.`);
            continue;
          }
        } catch {
          errors.push(`${item.email} : réponse non reçue. La même tentative sera réutilisée lors de la reprise.`);
          continue;
        }

        const wasSent = result.sentEmails?.includes(item.email) === true;
        const wasDuplicate = result.duplicateEmails?.includes(item.email) === true;
        if (wasSent || wasDuplicate) {
          created.history.sent[item.email] = {
            signature: item.signature,
            sentAt: new Date().toISOString(),
            rank: item.rank,
            time: item.time,
            player: item.player,
            partner: item.partner,
          };
          if (created.history.pending[item.email]?.requestId === item.requestId) {
            delete created.history.pending[item.email];
          }
          const persisted = writeRealDeliveryHistory(created.history);
          if (!persisted) {
            errors.push(`${item.email} : envoi confirmé, mais l’historique local n’a pas pu être sauvegardé. Le même identifiant protège la reprise contre un nouvel envoi.`);
          }
          if (wasSent) {
            confirmedCount += 1;
            if (item.kind === 'update') sentUpdates += 1;
            else sentInitial += 1;
          } else {
            duplicateCount += 1;
          }
          continue;
        }

        errors.push(`${item.email} : ${result.message || 'envoi non confirmé'}`);
        if (result.error === 'gmail_daily_quota_reached' || result.error === 'daily_limit_reached') {
          errors.push('Arrêt automatique : le quota d’envoi est atteint. Les destinataires restants restent en attente.');
          break;
        }
      }

      const next = createRealSendPlan();
      if (next.ok) setRealPlan(next.plan);

      if (errors.length > 0) {
        const remaining = next.ok ? next.plan.items.length : Math.max(0, plan.items.length - confirmedCount - duplicateCount);
        setRealMessage(
          `Envoi partiel : ${sentInitial} nouvelle(s) convocation(s), ${sentUpdates} mise(s) à jour envoyée(s), ${duplicateCount} déjà acceptée(s) précédemment. ${remaining} destinataire(s) restent à vérifier.\n${errors.join('\n')}`
        );
        setRealError(true);
      } else {
        setRealMessage(
          `Traitement terminé : ${sentInitial} première(s) convocation(s), ${sentUpdates} mise(s) à jour, ${duplicateCount} message(s) déjà accepté(s) lors d’une tentative précédente ; ${next.ok ? next.plan.unchangedCount : plan.unchangedCount} destinataire(s) n’ont rien reçu car leur convocation est inchangée.`
        );
        setRealError(false);
      }
    } catch (error) {
      setRealMessage(error instanceof Error ? error.message : 'Impossible de terminer l’envoi réel.');
      setRealError(true);
    } finally {
      setSendingReal(false);
    }
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
        <p className="text-sm text-muted-foreground mt-2 mb-3">ZE PADEL compare chaque destinataire à la dernière convocation confirmée dans ce navigateur. Une modification d’heure ou de contenu prépare une mise à jour seulement pour les joueurs concernés ; les autres ne reçoivent rien. Le suivi persiste après fermeture de l’onglet sur ce navigateur et cet appareil. Pour un nouveau tournoi, réinitialise explicitement le suivi.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={prepareRealPreview} disabled={busy || sendingReal}>
            Vérifier les destinataires
          </Button>
          <Button type="button" variant="outline" onClick={resetRealDeliveryHistory} disabled={busy || sendingReal}>
            Nouveau tournoi : réinitialiser le suivi
          </Button>
        </div>
        {showRealPreview && <div className="mt-4 rounded-md bg-muted/40 p-3">
          <p className="text-sm font-medium mb-2">Contrôle avant envoi</p>
          <p className={`text-sm whitespace-pre-line ${realError ? 'text-destructive' : 'text-muted-foreground'}`} role="status">{realMessage}</p>
          {realPlan && realPlan.items.length > 0 && !realError && <div className="mt-3">
            <p className="text-sm font-medium mb-2">
              ${realPlan.items.length} e-mail(s) à envoyer : {realPlan.initialCount} première(s) convocation(s), {realPlan.updateCount} mise(s) à jour, {realPlan.unchangedCount} destinataire(s) inchangé(s).
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {realPlan.items.slice(0, 12).map((item) => (
                <li key={item.email}>
                  Paire #{item.rank} — {item.email} — {item.kind === 'update' ? 'mise à jour' : 'première convocation'}
                  {item.kind === 'update' && item.previousTime && item.previousTime !== item.time ? ` (heure précédente : ${item.previousTime})` : ''}
                </li>
              ))}
            </ul>
            {realPlan.items.length > 12 && <p className="text-xs text-muted-foreground mt-2">… et {realPlan.items.length - 12} autre(s) destinataire(s).</p>}
          </div>}
          {!realError && realPlan && realPlan.items.length > 0 && <Button type="button" className="mt-3" onClick={() => void sendRealConvocations()} disabled={busy || sendingReal}>
            {sendingReal ? 'Envoi en cours…' : `Confirmer et envoyer ${realPlan.items.length} e-mail(s)`}
          </Button>}
        </div>}
      </div>

      <div className="table-scroll"><table className="teams-table"><thead><tr><th>Rang</th><th>Joueurs</th><th>E-mail joueur 1</th><th>E-mail joueur 2</th><th>Heure de convocation</th></tr></thead>
      <tbody>{state.teams.map(team => <tr key={team.rank}>
        <td>{team.rank}</td><td><strong>{team.player1 || 'Joueur 1 à renseigner'} / {team.player2 || 'Joueur 2 à renseigner'}</strong></td>
        <td><input aria-label={`E-mail joueur 1, paire ${team.rank}`} type="email" value={team.email1 ?? ''} onChange={e => { update({ ...state, teams: state.teams.map(t => t.rank === team.rank ? { ...t, email1: e.target.value } : t) }); setShowRealPreview(false); setRealPlan(null); setRealMessage(''); }} disabled={busy} placeholder="joueur1@exemple.fr" /></td>
        <td><input aria-label={`E-mail joueur 2, paire ${team.rank}`} type="email" value={team.email2 ?? ''} onChange={e => { update({ ...state, teams: state.teams.map(t => t.rank === team.rank ? { ...t, email2: e.target.value } : t) }); setShowRealPreview(false); setRealPlan(null); setRealMessage(''); }} disabled={busy} placeholder="joueur2@exemple.fr" /></td>
        <td><input aria-label={`Heure de convocation, paire ${team.rank}`} value={team.time} onChange={e => { update({ ...state, teams: state.teams.map(t => t.rank === team.rank ? { ...t, time: e.target.value } : t) }); setShowRealPreview(false); setRealPlan(null); setRealMessage(''); }} disabled={busy} placeholder="Ex. 09:30" /></td>
      </tr>)}</tbody></table></div>
    </section>
  </TournamentShell>;
}
