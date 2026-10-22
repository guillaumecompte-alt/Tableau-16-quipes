import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';

const TEST_RECIPIENTS = new Set(['guillaume.compte@gmail.com', 'williamdurand84@gmail.com', 'guigui99999@hotmail.com']);
const RELAY_URL = 'https://script.google.com/macros/s/AKfycbyaGyXhlw8F9PXzLVG-_MyyA7Ptcc65J-iqI9ejhWXsv1Ajk2YzdGvCbJfdVbg8ia9m/exec';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Team = { rank?: unknown; player1?: unknown; player2?: unknown; email1?: unknown; email2?: unknown; time?: unknown };
type Payload = {
  teams?: Team[];
  info?: { tournamentType?: unknown; date?: unknown; referee?: unknown };
  targetEmail?: unknown;
  requestId?: unknown;
  sendKind?: unknown;
};

const reply = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const clean = (v: unknown, max = 180) => typeof v === 'string' ? v.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c));

function htmlMail(tournament: string, date: string, referee: string, rank: number, player: string, partner: string, time: string, sendKind: 'initial' | 'update') {
  const rows = [['Tournoi', tournament], ['Date', date], ['Paire', `#${rank} — ${player} / ${partner}`], ['Heure de convocation', time], ['Juge-arbitre', referee || 'Non renseigné']];
  const isUpdate = sendKind === 'update';
  return `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><div style="border-left:5px solid #d9f16d;padding:8px 18px"><h2>${isUpdate ? 'Mise à jour de votre convocation' : 'Convocation au tournoi ZE PADEL'}</h2><p>Bonjour ${esc(player)},</p>${isUpdate ? '<p style="padding:10px;background:#fff7ed;color:#9a3412"><strong>Votre convocation a été mise à jour.</strong> Merci de vérifier l’heure et les informations ci-dessous.</p>' : '<p>Voici les informations de ta convocation :</p>'}<table style="border-collapse:collapse">${rows.map(([k,v]) => `<tr><td style="padding:6px 16px 6px 0;color:#64748b">${esc(k)}</td><td style="padding:6px 0;font-weight:bold">${esc(v)}</td></tr>`).join('')}</table><p>Merci d’arriver à l’heure indiquée et de prévoir le temps nécessaire pour l’accueil.</p><p>À bientôt sur les terrains,<br><strong>ZE PADEL</strong></p></div></body></html>`;
}

export const Route = createFileRoute('/api/send-convocations')({
  server: { handlers: {
    POST: async ({ request }) => {
      const origin = request.headers.get('origin');
      if (origin) {
        try { if (new URL(origin).origin !== new URL(request.url).origin) return reply({ok:false,error:'origin_not_allowed'},403); }
        catch { return reply({ok:false,error:'invalid_origin'},403); }
      }
      const token = (request.headers.get('authorization') ?? '').match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token) return reply({ok:false,error:'authentication_required',message:'Connecte-toi avec le compte autorisé pour envoyer les convocations.'},401);

      const env = typeof process !== 'undefined' ? process.env : undefined;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || env?.['SUPABASE_URL'] || env?.['VITE_SUPABASE_URL'];
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || env?.['SUPABASE_PUBLISHABLE_KEY'] || env?.['VITE_SUPABASE_PUBLISHABLE_KEY'];
      const secret = env?.['ZE_PADEL_API_SECRET'];
      const allowedSender = (env?.['ZE_PADEL_SENDER_EMAIL'] ?? '').trim().toLowerCase();
      if (!supabaseUrl || !supabaseKey || !secret || !allowedSender) return reply({ok:false,error:'server_not_configured',message:'L’envoi réel est verrouillé : il reste à configurer le compte expéditeur autorisé.'},503);

      let userEmail = '';
      try {
        const client = createClient(supabaseUrl, supabaseKey, {auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
        const {data,error} = await client.auth.getUser(token);
        if (error || !data.user) return reply({ok:false,error:'authentication_required'},401);
        userEmail = (data.user.email ?? '').trim().toLowerCase();
      } catch { return reply({ok:false,error:'authentication_check_failed'},401); }
      if (!userEmail || userEmail !== allowedSender) return reply({ok:false,error:'sender_not_authorized',message:'Ce compte n’est pas autorisé à envoyer les convocations.'},403);

      let payload: Payload;
      try { payload = await request.json() as Payload; } catch { return reply({ok:false,error:'invalid_json'},400); }
      const targetEmail = clean(payload.targetEmail,254).toLowerCase();
      const requestId = clean(payload.requestId,100);
      const sendKind = clean(payload.sendKind,20);
      if (!EMAIL_RE.test(targetEmail) || targetEmail.length > 254) return reply({ok:false,error:'invalid_target_email',message:'Destinataire ciblé invalide.'},400);
      if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestId)) return reply({ok:false,error:'invalid_request_id',message:'Identifiant de tentative invalide.'},400);
      if (sendKind !== 'initial' && sendKind !== 'update') return reply({ok:false,error:'invalid_send_kind',message:'Type d’envoi invalide.'},400);
      const tournament = clean(payload.info?.tournamentType,120);
      const date = clean(payload.info?.date,40);
      const referee = clean(payload.info?.referee,120);
      if (!tournament || !date || !Array.isArray(payload.teams) || payload.teams.length !== 16) return reply({ok:false,error:'tournament_incomplete',message:'Renseigne le type et la date du tournoi et vérifie les 16 équipes.'},400);

      const ranks = new Set<number>();
      const emails = new Set<string>();
      const recipients: {rank:number;player:string;partner:string;email:string;time:string}[] = [];
      const issues: string[] = [];
      for (const t of payload.teams) {
        const rank = Number(t.rank), player1 = clean(t.player1), player2 = clean(t.player2), time = clean(t.time,80);
        if (!Number.isInteger(rank) || rank < 1 || rank > 16 || ranks.has(rank)) { issues.push('Les rangs des équipes doivent être uniques de 1 à 16.'); continue; }
        ranks.add(rank);
        if (!player1 || !player2 || !time) { issues.push(`Paire #${rank} : joueur(s) ou heure de convocation manquant(s).`); continue; }
        for (const [value,player,partner] of [[t.email1,player1,player2],[t.email2,player2,player1]] as const) {
          const email = clean(value,254).toLowerCase();
          if (!EMAIL_RE.test(email) || email.length > 254) { issues.push(`Paire #${rank} : adresse e-mail absente ou invalide.`); continue; }
          if (TEST_RECIPIENTS.has(email)) { issues.push(`Paire #${rank} : adresse de test encore utilisée (${email}).`); continue; }
          if (emails.has(email)) { issues.push(`Adresse e-mail utilisée plusieurs fois : ${email}.`); continue; }
          emails.add(email); recipients.push({rank,player,partner,email,time});
        }
      }
      if (ranks.size !== 16) issues.push('Les 16 rangs doivent être présents.');
      if (recipients.length !== 32) issues.push('Il faut 32 adresses e-mail distinctes pour l’envoi réel.');
      if (issues.length) return reply({ok:false,error:'recipient_validation_failed',message:'Envoi bloqué : corrige les adresses et les informations avant de contacter les joueurs.',issues:Array.from(new Set(issues)).slice(0,20)},400);

      recipients.sort((a,b) => a.rank-b.rank || a.email.localeCompare(b.email));
      const recipient = recipients.find((item) => item.email === targetEmail);
      if (!recipient) {
        return reply({ok:false,error:'target_not_in_roster',message:'Le destinataire ciblé ne correspond à aucune des 32 adresses validées.'},400);
      }

      // This endpoint sends one recipient per Worker request to stay below
      // Cloudflare's subrequest ceiling when Apps Script redirects its response.
      const subject = sendKind === 'update'
        ? `Mise à jour de votre convocation ZE PADEL — ${tournament} — paire #${recipient.rank}`
        : `Convocation ZE PADEL — ${tournament} — paire #${recipient.rank}`;
      const text = [
        sendKind === 'update' ? 'MISE À JOUR DE VOTRE CONVOCATION — ZE PADEL' : 'CONVOCATION ZE PADEL',
        '',
        `Bonjour ${recipient.player},`,
        '',
        sendKind === 'update'
          ? 'Votre convocation a été mise à jour. Merci de vérifier l’heure et les informations ci-dessous.'
          : 'Voici les informations de ta convocation :',
        `Tournoi : ${tournament}`,
        `Date : ${date}`,
        `Paire #${recipient.rank} : ${recipient.player} / ${recipient.partner}`,
        `Heure de convocation : ${recipient.time}`,
        `Juge-arbitre : ${referee || 'Non renseigné'}`,
        '',
        'Merci d’arriver à l’heure indiquée et de prévoir le temps nécessaire pour l’accueil.',
        '',
        'À bientôt sur les terrains,',
        'ZE PADEL',
      ].join('\\n');

      try {
        const response = await fetch(RELAY_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            mode: 'PRODUCTION',
            secret,
            to: recipient.email,
            requestId,
            subject,
            text,
            html: htmlMail(tournament, date, referee, recipient.rank, recipient.player, recipient.partner, recipient.time, sendKind),
          }),
          redirect: 'follow',
        });
        let relayResult: { ok?: boolean; sent?: boolean; error?: string } = {};
        try { relayResult = JSON.parse(await response.text()) as typeof relayResult; } catch {}

        if (response.ok && relayResult.ok === true && relayResult.sent === true) {
          return reply({
            ok: true,
            status: 'sent',
            sentCount: 1,
            duplicateCount: 0,
            sentEmails: [recipient.email],
            duplicateEmails: [],
            failedEmails: [],
            message: sendKind === 'update' ? 'Mise à jour de convocation envoyée.' : 'Convocation envoyée.',
          });
        }
        if (relayResult.error === 'duplicate_request') {
          return reply({
            ok: true,
            status: 'duplicate',
            sentCount: 0,
            duplicateCount: 1,
            sentEmails: [],
            duplicateEmails: [recipient.email],
            failedEmails: [],
            message: 'Ce même message avait déjà été accepté par le relais ; il ne sera pas renvoyé.',
          });
        }

        const reason = relayResult.error || `http_${response.status}`;
        const isQuota = reason === 'gmail_daily_quota_reached' || reason === 'daily_limit_reached';
        const message = reason === 'gmail_daily_quota_reached'
          ? 'Quota Google épuisé. Les autres destinataires restent en attente.'
          : reason === 'daily_limit_reached'
            ? 'Limite de sécurité quotidienne ZE PADEL atteinte. Les autres destinataires restent en attente.'
            : reason === 'production_mode_not_enabled'
              ? 'Le relais est toujours en mode TEST_ONLY. L’envoi réel reste désactivé.'
              : `Le relais Gmail a refusé ce message (${reason}).`;
        return reply({
          ok: false,
          error: reason,
          sentCount: 0,
          duplicateCount: 0,
          failureCount: 1,
          sentEmails: [],
          duplicateEmails: [],
          failedEmails: [recipient.email],
          message,
        }, isQuota ? 429 : 502);
      } catch {
        return reply({
          ok: false,
          error: 'relay_network_error',
          sentCount: 0,
          duplicateCount: 0,
          failureCount: 1,
          sentEmails: [],
          duplicateEmails: [],
          failedEmails: [recipient.email],
          message: 'La réponse du relais n’a pas pu être confirmée. Tu peux reprendre plus tard : le même identifiant empêchera un doublon si le message était déjà accepté.',
        }, 502);
      }
    }\n  }}\n});\n