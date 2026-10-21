import { createFileRoute } from '@tanstack/react-router';

const TEST_RECIPIENT = 'guigui99999@hotmail.com';
const RELAY_URL =
  'https://script.google.com/macros/s/AKfycbyaGyXhlw8F9PXzLVG-_MyyA7Ptcc65J-iqI9ejhWXsv1Ajk2YzdGvCbJfdVbg8ia9m/exec';

type Payload = {
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

export const Route = createFileRoute('/api/test-hotmail')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get('origin');
        if (!origin) return jsonResponse({ ok: false, message: 'Origine de la requête manquante.' }, 403);
        try {
          if (new URL(origin).origin !== new URL(request.url).origin) {
            return jsonResponse({ ok: false, message: 'Origine de la requête refusée.' }, 403);
          }
        } catch {
          return jsonResponse({ ok: false, message: 'Origine de la requête invalide.' }, 403);
        }

        const secret = (typeof process !== 'undefined' ? process.env?.['ZE_PADEL_API_SECRET'] : undefined);
        if (!secret) {
          return jsonResponse({
            ok: false,
            message: 'Le secret du relais Gmail n’est pas configuré côté serveur.',
          }, 503);
        }

        let payload: Payload;
        try {
          payload = await request.json() as Payload;
        } catch {
          return jsonResponse({ ok: false, message: 'Données de test invalides.' }, 400);
        }

        const rank = Number(payload.team?.rank);
        const player1 = cleanText(payload.team?.player1);
        const player2 = cleanText(payload.team?.player2);
        const time = cleanText(payload.team?.time, 80) || 'Non renseignée';
        const tournament = cleanText(payload.tournament?.tournamentType, 120) || 'À définir';
        const date = cleanText(payload.tournament?.date, 80) || 'À définir';
        const referee = cleanText(payload.tournament?.referee, 120) || 'Non renseigné';

        if (!Number.isInteger(rank) || rank < 1 || rank > 16 || !player1 || !player2) {
          return jsonResponse({
            ok: false,
            message: 'La paire de rang 1 doit contenir deux noms de joueurs.',
          }, 400);
        }

        const rows = [
          ['Tournoi', tournament],
          ['Date', date],
          ['Paire', `#${rank} — ${player1} / ${player2}`],
          ['Heure de convocation', time],
          ['Juge-arbitre', referee],
        ];
        const html = `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
          <div style="border-left:5px solid #d9f16d;padding:8px 18px">
            <p style="font-weight:bold;color:#b45309">TEST — NON OFFICIEL</p>
            <h2>Test de réception ZE PADEL</h2>
            <p>Ceci est un test technique unique vers une troisième boîte de test. Ce n’est pas une convocation officielle.</p>
            <table style="border-collapse:collapse">${rows.map(([label, value]) =>
              `<tr><td style="padding:6px 16px 6px 0;color:#64748b">${escapeHtml(label)}</td><td style="padding:6px 0;font-weight:bold">${escapeHtml(value)}</td></tr>`
            ).join('')}</table>
            <p>Destinataire de test : ${TEST_RECIPIENT}</p>
          </div></body></html>`;
        const text = [
          'TEST ZE PADEL — NON OFFICIEL',
          '',
          'Ceci est un test technique unique vers une troisième boîte de test. Ce n’est pas une convocation officielle.',
          `Tournoi : ${tournament}`,
          `Date : ${date}`,
          `Paire #${rank} : ${player1} / ${player2}`,
          `Heure de convocation : ${time}`,
          `Juge-arbitre : ${referee}`,
          `Destinataire de test : ${TEST_RECIPIENT}`,
        ].join('\n');

        try {
          const relayResponse = await fetch(RELAY_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              mode: 'TEST_ONLY',
              secret,
              to: TEST_RECIPIENT,
              requestId: `hotmail_test_${crypto.randomUUID()}`,
              subject: `[TEST ZE PADEL HOTMAIL] Convocation — paire #${rank}`,
              text,
              html,
            }),
            redirect: 'follow',
          });
          let result: { ok?: boolean; sent?: boolean; error?: string } = {};
          try {
            result = JSON.parse(await relayResponse.text()) as typeof result;
          } catch {
            return jsonResponse({
              ok: false,
              message: `Le relais n’a pas renvoyé de réponse JSON (HTTP ${relayResponse.status}). Vérifie le déploiement Apps Script.`,
            }, 502);
          }
          if (relayResponse.ok && result.ok === true && result.sent === true) {
            return jsonResponse({
              ok: true,
              message: `Un e-mail de test a été accepté par le relais pour ${TEST_RECIPIENT}. Vérifie la boîte de réception et le dossier Indésirables.`,
            });
          }
          const reason = result.error || `HTTP ${relayResponse.status}`;
          const friendly = reason === 'recipient_not_allowed_in_test_mode'
            ? 'Hotmail n’est pas encore autorisée dans la liste TEST_ONLY du script Google Apps Script. Ajoute cette adresse à TEST_RECIPIENTS puis déploie une nouvelle version.'
            : `Le relais Gmail a refusé le test (${reason}). Aucun envoi réel aux joueurs n’a été demandé.`;
          return jsonResponse({ ok: false, message: friendly }, 502);
        } catch {
          return jsonResponse({
            ok: false,
            message: 'La connexion au relais Gmail a échoué. Aucun envoi réel aux joueurs n’a été demandé.',
          }, 502);
        }
      },
    },
  },
});
