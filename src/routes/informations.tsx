import { createFileRoute } from '@tanstack/react-router';
import { ClipboardList } from 'lucide-react';
import { TournamentShell } from '@/components/padel/tournament-shell';
import { useTournament } from '@/components/padel/use-tournament';
import type { TournamentInfo } from '@/lib/padel/tournament';

export const Route = createFileRoute('/informations')({
  head: () => ({ meta: [
    { title: 'ZE PADEL · Informations du tournoi' },
    { name: 'description', content: 'Renseignez le type, la date et le juge-arbitre du tournoi ZE PADEL.' },
  ] }),
  component: TournamentInformationPage,
});

const EMPTY_INFO: TournamentInfo = { tournamentType: '', date: '', referee: '' };

function TournamentInformationPage() {
  const { state, update, busy, dirty, localBackupReady, user } = useTournament();
  const info = state.info ?? EMPTY_INFO;

  function updateField(field: keyof TournamentInfo, value: string) {
    update({
      ...state,
      info: { ...EMPTY_INFO, ...state.info, [field]: value },
    });
  }

  return <TournamentShell>
    <section className="content-section">
      <div className="section-heading">
        <div>
          <span className="section-eyebrow">PARAMÈTRES DU TOURNOI</span>
          <h2>Informations du tournoi</h2>
        </div>
      </div>
      <section className="tournament-info-panel" aria-label="Informations générales du tournoi">
        <div className="tournament-info-intro">
          <span className="tournament-info-icon"><ClipboardList size={22} /></span>
          <p>Renseignez les informations générales de la compétition. Elles seront conservées avec les équipes, le tirage et les résultats.</p>
        </div>
        <div className="tournament-info-grid">
          <label className="form-label tournament-info-field">
            Type de tournoi
            <input
              type="text"
              value={info.tournamentType}
              maxLength={60}
              placeholder="P25, P50, P100, etc."
              autoComplete="off"
              onChange={event => updateField('tournamentType', event.target.value)}
            />
          </label>
          <label className="form-label tournament-info-field">
            Date du tournoi
            <input
              type="date"
              value={info.date}
              onChange={event => updateField('date', event.target.value)}
            />
          </label>
          <label className="form-label tournament-info-field tournament-info-field-wide">
            Juge-arbitre du tournoi
            <input
              type="text"
              value={info.referee}
              maxLength={120}
              placeholder="Nom et prénom du juge-arbitre"
              autoComplete="name"
              onChange={event => updateField('referee', event.target.value)}
            />
          </label>
        </div>
        <div className="tournament-info-footnote" role="status">
          {busy
            ? 'Enregistrement en cours…'
            : dirty
              ? localBackupReady
                ? 'Modifications conservées automatiquement sur ce navigateur. Pour les retrouver sur un autre appareil, utilise « Enregistrer en ligne » si tu es connecté.'
                : 'Modifications en attente. Télécharge une copie de sauvegarde pour sécuriser les informations.'
              : localBackupReady
                ? user
                  ? 'Informations enregistrées sur ce navigateur et synchronisées en ligne.'
                  : 'Informations enregistrées sur ce navigateur.'
                : 'La sauvegarde locale est indisponible. Télécharge une copie de sauvegarde pour conserver les informations.'}
        </div>
      </section>
    </section>
  </TournamentShell>;
}
