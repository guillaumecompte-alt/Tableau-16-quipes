import { Link, useLocation } from '@tanstack/react-router';
import { useRef, useState, type ReactNode } from 'react';
import { GitBranch, Users, Trophy, CircleDot, Shuffle, CalendarDays, MapPin, ArrowUpRight, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTournament } from './use-tournament';
import court from '@/assets/padel-court.jpg';
import { parseTournamentBackup, serializeTournamentBackup } from '@/lib/padel/local-backup';

export function TournamentShell({ children }: { children: ReactNode }) {
  const { state, restoreState, busy, dirty, notice, localBackupReady } = useTournament();
  const [backupFeedback, setBackupFeedback] = useState('');
  const backupInput = useRef<HTMLInputElement>(null);
  const path = useLocation().pathname;
  const nav = [{ to: '/' as const, title: 'Tableau du tournoi', icon: GitBranch }, { to: '/equipes' as const, title: 'Équipes', icon: Users }, { to: '/classement' as const, title: 'Classement', icon: Trophy }];
  return <div className="app-layout">
    <aside className="app-sidebar">
      <Link to="/" className="brand"><span className="brand-symbol"><CircleDot size={24} /></span><span>ZE <span className="text-lime">PADEL</span><small>GESTION DES TOURNOIS</small></span></Link>
      <div className="sidebar-label">VOTRE TOURNOI</div>
      <div className="sidebar-tournament"><div className="flex items-center gap-2"><span className="live-dot" /> P100 · Ze Padel</div><span>TMC 16 · Entrée échelonnée</span></div>
      <nav>{nav.map(item => <Button key={item.to} asChild variant="ghost" className={`nav-item ${path === item.to ? 'nav-active' : ''}`}><Link to={item.to}><item.icon size={18} />{item.title}{item.to === '/equipes' && <span className="nav-count">16</span>}</Link></Button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-rule"><Shuffle size={17} /><span>Tirage par rang<small>4 groupes · 16 équipes</small></span></div><div className="sidebar-account"><span className="account-avatar">JA</span><div>Juge-arbitre<small>Mode 100 % local</small></div></div></div>
    </aside>
    <div className="app-main"><header className="topbar"><span>Mes tournois <span className="breadcrumb-divider">/</span> <strong>P100 · Ze Padel</strong></span><div className="topbar-actions flex items-center gap-2">
        <span className="save-status">{busy ? 'Chargement…' : dirty ? 'Modifications non sauvegardées' : localBackupReady ? 'Sauvegarde locale active' : 'Copie locale indisponible'}</span>
        <Button type="button" variant="outline" size="sm" className="backup-action" disabled={busy} title="Télécharger une sauvegarde sur ce PC" aria-label="Télécharger une sauvegarde sur ce PC" onClick={() => { try { const blob = new Blob([serializeTournamentBackup(state)], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `ze-padel-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setBackupFeedback('Sauvegarde téléchargée sur le PC. Garde ce fichier dans un endroit sûr.'); } catch { setBackupFeedback('Le téléchargement de la sauvegarde a échoué. Réessaie ou vérifie les paramètres du navigateur.'); } }}><Download size={15} /><span className="backup-action-label">Copie sur PC</span></Button>
        <Button type="button" variant="outline" size="sm" className="backup-action" disabled={busy} title="Restaurer une sauvegarde depuis ce PC" aria-label="Restaurer une sauvegarde depuis ce PC" onClick={() => backupInput.current?.click()}><Upload size={15} /><span className="backup-action-label">Restaurer</span></Button>
        <input ref={backupInput} className="hidden" type="file" accept=".json,application/json" aria-label="Fichier de sauvegarde ZE PADEL" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; setBackupFeedback(''); try { const backup = parseTournamentBackup(await file.text()); const date = new Date(backup.savedAt).toLocaleString('fr-FR'); const confirmed = window.confirm(`Restaurer la sauvegarde du ${date} ? Cela remplacera les équipes, le tirage et les résultats actuellement affichés. Une copie locale sera créée immédiatement.`); if (confirmed) {
      setBackupFeedback('Restauration en cours…');
      const outcome = await restoreState(backup.state);
      const teamCount = backup.state.teams.length;
      const drawCount = Object.keys(backup.state.draw).length;
      const saveText = outcome.localSaved
        ? ' La sauvegarde est conservée localement sur ce PC.'
        : ' Attention : la sauvegarde automatique a échoué ; garde le fichier JSON.';
      setBackupFeedback(`Sauvegarde restaurée : ${teamCount} équipes et ${drawCount} affectations de tirage récupérées.${saveText}`);
    } } catch (error) { setBackupFeedback(error instanceof Error ? error.message : 'Impossible de lire ce fichier de sauvegarde.'); } finally { if (backupInput.current) backupInput.current.value = ''; } }} />
        <span className="save-status">100 % local · hors ligne</span>
      </div></header>
      {backupFeedback && <p className="backup-feedback" role="status">{backupFeedback}</p>}
      <main><section className="tournament-cover"><img src={court} width={1536} height={512} alt="Terrain de padel avec raquette et balles" /><div className="cover-shade" /><div className="cover-content"><span className="category-label">P100 <span>TOURNOI MULTI-CHANCES</span></span><h1>Ze Padel</h1><div className="cover-details"><span><CalendarDays size={15} />7 juillet 2025</span><span><MapPin size={15} />Ze Padel</span><span><Users size={15} />16 équipes</span></div></div><span className="cover-tag"><span className="live-dot" />{Object.keys(state.results).length === 28 ? 'Terminé' : Object.keys(state.results).length ? 'En cours' : 'À préparer'}</span></section>
      {notice && <p className="notice" role="status">{notice}</p>}
      {children}
      <footer className="app-footer"><span>Ze Padel · P100 · 16 équipes</span><span>Entrée échelonnée <ArrowUpRight size={13} /></span></footer></main>
    </div>
  </div>;
}