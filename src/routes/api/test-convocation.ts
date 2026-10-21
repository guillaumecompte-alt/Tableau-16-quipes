import { createFileRoute } from '@tanstack/react-router';
const TEST_RECIPIENTS = [
  'guillaume.compte@gmail.com',
  'williamdurand84@gmail.com',
] as const;

const GMAIL_RELAY_URL =
  'https://script.google.com/macros/s/AKfycbyaGyXhlw8F9PXzLVG-_MyyA7Ptcc65J-iqI9ejhWXsv1Ajk2YzdGvCbJfdVbg8ia9m/exec';

type TestPayload = {
  team?: {
    rank?: unknown;
    player1?: unknown;
    player2?: unknown;
    time?: unknown;
  };
  tournament?: {
    tournamentType?: unknown;
    date?: unknown;
    referee?: unknown;
  };
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function cleanText(value: unknown, maxLength = 160): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength);
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

function htmlResponsePage(
  tournamentType: string,
  date: string,
  referee: string,
  rank: number,
  player1: string,
  player2: string,
  time: string,
): string {
  const rows = [
    ['Tournoi', tournamentType || 'À définir'],
    ['Date', date || 'À définir'],
    ['Paire', `#${rank} — ${player1} / ${player2}`],
    ['Heure de convocation', time || 'Non renseignée'],
    ['Juge-arbitre', referee || 'Non renseigné'],
  ];
  return `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
    <div style="border-left:5px solid #d9f16d;padding:8px 18px">
      <p style="font-weight:bold;color:#64748b">MESSAGE DE TEST — ZE PADEL</p>
      <h2>Convocation au tournoi</h2>
      <p>Ceci est un essai technique. Cette convocation n'est pas définitive.</p>
      <table style="border-collapse:collapse">${rows.map(([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#64748b">${escapeHtml(label)}</td><td style="padding:6px 0;font-weight:bold">${escapeHtml(value)}</td></tr>`
      ).join('')}</table>
      <p style="margin-top:22px;color:#64748b;font-size:12px">E-mail de test envoyé par ZE PADEL.</p>
    </div>
  </body></html>`;
}

// Public test endpoint: recipient addresses are hard-coded below and the Gmail relay
// enforces a strict daily quota. Never accept a client-supplied recipient.
export const Route = createFileRoute('/api/test-convocation')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get('origin');
        if (origin) {
          try {
            if (new URL(origin).origin !== new URL(request.url).origin) {
              return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403);
            }
          } catch {
            return jsonResponse({ ok: false, error: 'invalid_origin' }, 403);
          }
        }

        const env = typeof process !== 'undefined' ? process.env : undefined;
        const relaySecret = env?.['ZE_PADEL_API_SECRET'];

        if (!relaySecret) {
          return jsonResponse({
            ok: false,
            error: 'server_not_configured',
            message: 'Configuration serveur incomplète. Vérifie le secret Cloudflare.',
          }, 503);
        }

        let body: TestPayload;
        try {
          body = await request.json() as TestPayload;
        } catch {
          return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
        }

        const team = body.team;
        const tournament = body.tournament;
        const rank = Number(team?.rank);
        const player1 = cleanText(team?.player1);
        const player2 = cleanText(team?.player2);
        const time = cleanText(team?.time, 80);
        const tournamentType = cleanText(tournament?.tournamentType, 120);
        const date = cleanText(tournament?.date, 80);
        const referee = cleanText(tournament?.referee, 120);

        if (
          !Number.isInteger(rank) || rank < 1 || rank > 16 ||
          !player1 || !player2
        ) {
          return jsonResponse({
            ok: false,
            error: 'invalid_team',
            message: 'La paire de test doit contenir deux noms de joueurs valides.',
          }, 400);
        }

        const subject = `[TEST ZE PADEL] Convocation — paire #${rank}`;
        const text = [
          'MESSAGE DE TEST — ZE PADEL',
          '',
          'Ceci est un essai technique. Cette convocation n’est pas définitive.',
          '',
          `Tournoi : ${tournamentType || 'À définir'}`,
          `Date : ${date || 'À définir'}`,
          `Paire #${rank} : ${player1} / ${player2}`,
          `Heure de convocation : ${time || 'Non renseignée'}`,
          `Juge-arbitre : ${referee || 'Non renseigné'}`,
          '',
          'E-mail de test envoyé par ZE PADEL.',
        ].join('\n');
        const html = htmlResponsePage(
          tournamentType, date, referee, rank, player1, player2, time,
        );

        const requestId = crypto.randomUUID();
        const sentTo: string[] = [];
        const failures: string[] = [];

        for (const to of TEST_RECIPIENTS) {
          try {
            const relayResponse = await fetch(GMAIL_RELAY_URL, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                secret: relaySecret,
                to,
                requestId,
                subject,
                text,
                html,
              }),
              redirect: 'follow',
            });

            const relayText = await relayResponse.text();
            let relayResult: { ok?: boolean; sent?: boolean; error?: string } = {};
            try {
              relayResult = JSON.parse(relayText) as typeof relayResult;
            } catch {
              // Non-JSON replies are deliberately not surfaced to the browser.
            }

            if (relayResponse.ok && relayResult.ok === true && relayResult.sent === true) {
              sentTo.push(to);
            } else {
              failures.push(to);
            }
          } catch {
            failures.push(to);
          }
        }

        if (failures.length > 0) {
          return jsonResponse({
            ok: false,
            error: sentTo.length > 0 ? 'partial_send' : 'send_failed',
            sentTo,
            failedCount: failures.length,
            message: sentTo.length > 0
              ? 'Un seul des deux e-mails a été accepté. Vérifie la boîte de réception avant de réessayer.'
              : 'Le relais Gmail n’a pas confirmé l’envoi. Vérifie le déploiement Apps Script et le secret Cloudflare.',
          }, 502);
        }

        return jsonResponse({
          ok: true,
          sentTo,
          message: 'Les deux e-mails de test ont été acceptés par le relais Gmail.',
        });
      },
    },
  },
});
