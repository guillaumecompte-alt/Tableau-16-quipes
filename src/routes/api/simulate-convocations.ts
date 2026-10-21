import { createFileRoute } from '@tanstack/react-router';

const TEST_RECIPIENTS = [
  'guillaume.compte@gmail.com',
  'williamdurand84@gmail.com',
] as const;
const RELAY_URL =
  'https://script.google.com/macros/s/AKfycbyaGyXhlw8F9PXzLVG-_MyyA7Ptcc65J-iqI9ejhWXsv1Ajk2YzdGvCbJfdVbg8ia9m/exec';

type Team = {
  rank?: unknown;
  player1?: unknown;
  player2?: unknown;
  time?: unknown;
};
type Payload = {
  messageIndex?: unknown;
  teams?: Team[];
  tournament?: {
    tournamentType?: unknown;
    date?: unknown;
    referee?: unknown;
  };
};

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function cleanText(value: unknown, maxLength = 160): string {
  return typeof value === 'string'
    ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength)
    : '';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

function buildHtml(
  recipient: string,
  tournament: string,
  date: string,
  referee: string,
  rank: number,
  player: string,
  partner: string,
  time: string,
): string {
  const rows = [
    ['Tournoi', tournament],
    ['Date', date],
    ['Paire', `#${rank} — ${player} / ${partner}`],
    ['Heure de convocation', time],
    ['Juge-arbitre', referee || 'Non renseigné'],
  ];
  return `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
    <div style="border-left:5px solid #d9f16d;padding:8px 18px">
      <p style="font-weight:bold;color:#b45309">SIMULATION — NON OFFICIELLE</p>
      <h2>Simulation de convocation ZE PADEL</h2>
      <p>Bonjour ${escapeHtml(player)},</p>
      <p>Voici les informations qui figureraient sur la convocation :</p>
      <table style="border-collapse:collapse">${rows.map(([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#64748b">${escapeHtml(label)}</td><td style="padding:6px 0;font-weight:bold">${escapeHtml(value)}</td></tr>`
      ).join('')}</table>
      <p style="margin-top:20px;padding:10px;background:#fff7ed;color:#9a3412"><strong>Simulation uniquement.</strong> Ce message est envoyé à une adresse de test pour vérifier le contenu. Ce n'est pas une convocation officielle et il ne doit pas être transmis au joueur.</p>
      <p style="font-size:12px;color:#64748b">Boîte de test destinataire : ${escapeHtml(recipient)}</p>
    </div>
  </body></html>`;
}

async function getCampaignId(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export const Route = createFileRoute('/api/simulate-convocations')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get('origin');
        if (!origin) {
          return response({ ok: false, error: 'origin_required' }, 403);
        }
        try {
          if (new URL(origin).origin !== new URL(request.url).origin) {
            return response({ ok: false, error: 'origin_not_allowed' }, 403);
          }
        } catch {
          return response({ ok: false, error: 'invalid_origin' }, 403);
        }

        const env = typeof process !== 'undefined' ? process.env : undefined;
        const secret = env?.['ZE_PADEL_API_SECRET'];
        if (!secret) {
          return response({
            ok: false,
            error: 'server_not_configured',
            message: 'Le secret du relais Gmail n’est pas configuré dans Cloudflare.',
          }, 503);
        }

        let payload: Payload;
        try {
          payload = await request.json() as Payload;
        } catch {
          return response({ ok: false, error: 'invalid_json' }, 400);
        }

        const tournament = cleanText(payload.tournament?.tournamentType, 120);
        const date = cleanText(payload.tournament?.date, 80);
        const referee = cleanText(payload.tournament?.referee, 120);
        const teams = payload.teams;
        const messageIndex = Number(payload.messageIndex);
        if (!Number.isInteger(messageIndex) || messageIndex < 0 || messageIndex > 31) {
          return response({ ok: false, error: 'invalid_message_index', message: 'L’index du message doit être compris entre 0 et 31.' }, 400);
        }
        if (!tournament || !date || !Array.isArray(teams) || teams.length !== 16) {
          return response({
            ok: false,
            error: 'tournament_incomplete',
            message: 'Renseigne le type et la date du tournoi et vérifie les 16 paires avant la simulation.',
          }, 400);
        }

        const ranks = new Set<number>();
        const messages: Array<{
          rank: number;
          slot: 1 | 2;
          player: string;
          partner: string;
          time: string;
          testTo: string;
        }> = [];
        const issues: string[] = [];

        for (const team of teams) {
          const rank = Number(team.rank);
          const player1 = cleanText(team.player1);
          const player2 = cleanText(team.player2);
          const time = cleanText(team.time, 80);

          if (!Number.isInteger(rank) || rank < 1 || rank > 16 || ranks.has(rank)) {
            issues.push('Les rangs doivent être uniques de 1 à 16.');
            continue;
          }
          ranks.add(rank);
          if (!player1 || !player2 || !time) {
            issues.push(`Paire #${rank} : nom(s) de joueur ou heure de convocation manquant(s).`);
            continue;
          }

          messages.push({
            rank, slot: 1, player: player1, partner: player2, time,
            testTo: TEST_RECIPIENTS[0],
          });
          messages.push({
            rank, slot: 2, player: player2, partner: player1, time,
            testTo: TEST_RECIPIENTS[1],
          });
        }

        if (ranks.size !== 16) issues.push('Les 16 rangs doivent être présents.');
        if (messages.length !== 32) issues.push('La simulation doit comporter exactement 32 messages.');
        if (issues.length > 0) {
          return response({
            ok: false,
            error: 'simulation_validation_failed',
            message: 'Simulation bloquée : complète les informations indiquées avant de continuer.',
            issues: Array.from(new Set(issues)).slice(0, 20),
          }, 400);
        }

        messages.sort((a, b) => a.rank - b.rank || a.slot - b.slot);
        const campaignFingerprint = JSON.stringify({
          tournament, date, referee,
          messages: messages.map(({ rank, slot, player, partner, time, testTo }) => ({
            rank, slot, player, partner, time, testTo,
          })),
        });
        const campaignId = await getCampaignId(campaignFingerprint);
        // One outbound email per Worker invocation keeps the Apps Script redirect well below subrequest limits.
        const batchMessages = [messages[messageIndex]];
        let sentCount = 0;
        let duplicateCount = 0;
        const errors: string[] = [];

        for (const item of batchMessages) {
          const requestId = `sim_${campaignId}_${item.rank}_${item.slot}`;
          const subject = `[SIMULATION ZE PADEL] Convocation — paire #${item.rank}`;
          const text = [
            'SIMULATION — NON OFFICIELLE',
            '',
            `Bonjour ${item.player},`,
            '',
            'Voici les informations qui figureraient sur la convocation :',
            `Tournoi : ${tournament}`,
            `Date : ${date}`,
            `Paire #${item.rank} : ${item.player} / ${item.partner}`,
            `Heure de convocation : ${item.time}`,
            `Juge-arbitre : ${referee || 'Non renseigné'}`,
            '',
            'SIMULATION UNIQUEMENT : ce message a été envoyé à une boîte de test pour contrôler le contenu. Ce n’est pas une convocation officielle.',
            `Boîte de test destinataire : ${item.testTo}`,
          ].join('\n');

          try {
            const relayResponse = await fetch(RELAY_URL, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                mode: 'TEST_ONLY',
                secret,
                to: item.testTo,
                requestId,
                subject,
                text,
                html: buildHtml(
                  item.testTo, tournament, date, referee,
                  item.rank, item.player, item.partner, item.time,
                ),
              }),
              redirect: 'follow',
            });

            let relayResult: { ok?: boolean; sent?: boolean; error?: string } = {};
            try {
              relayResult = JSON.parse(await relayResponse.text()) as typeof relayResult;
            } catch {
              // Treat unexpected replies as a failed send confirmation.
            }

            if (relayResponse.ok && relayResult.ok === true && relayResult.sent === true) {
              sentCount += 1;
            } else if (relayResult.error === 'duplicate_request') {
              duplicateCount += 1;
            } else {
              errors.push(`Paire #${item.rank}, joueur ${item.slot}: ${relayResult.error ?? 'erreur du relais'}`);
            }
          } catch {
            errors.push(`Paire #${item.rank}, joueur ${item.slot}: erreur réseau`);
          }
        }

        if (errors.length > 0) {
          return response({
            ok: false,
            error: 'partial_simulation',
            sentCount,
            duplicateCount,
            failureCount: errors.length,
            message: `Le message ${messageIndex + 1}/32 (paire #${batchMessages[0]?.rank ?? '?'}) est partiel.`,
            issues: errors.slice(0, 10),
          }, 502);
        }

        return response({
          ok: true,
          sentCount,
          duplicateCount,
          messageIndex,
          toGuillaume: batchMessages.filter((message) => message.testTo === TEST_RECIPIENTS[0]).length,
          toWilliam: batchMessages.filter((message) => message.testTo === TEST_RECIPIENTS[1]).length,
          message: sentCount === 0
            ? `Message ${messageIndex + 1}/32 déjà traité. Aucun doublon envoyé.`
            : `Message ${messageIndex + 1}/32 envoyé.`,
        });
      },
    },
  },
});
