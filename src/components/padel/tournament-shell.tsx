import { Link, useLocation } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { GitBranch, Users, Trophy, CircleDot, Shuffle, LogOut, Save, X, CalendarDays, MapPin, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lovable } from '@/integrations/lovable';
import { supabase } from '@/integrations/supabase/client';
import { useTournament } from './use-tournament';
import court from '@/assets/padel-court.jpg';

export function TournamentShell({ children }: { children: ReactNode }) {
  const { state, user, save, busy, dirty, notice } = useTournament();
  const [login, setLogin] = useState(false); const [authError, setAuthError] = useState('');
  const path = useLocation().pathname;
  const nav = [{ to: '/' as const, title: 'Tableau du tournoi', icon: GitBranch }, { to: '/equipes' as const, title: 'Équipes', icon: Users }, { to: '/classement' as const, title: 'Classement', icon: Trophy }];
  async function signIn(provider: 'google' | 'lovable') { const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }); if (result.error) setAuthError('Connexion impossible. Veuillez réessayer.'); else setLogin(false); }
  return <div className="app-layout">
    <aside className="app-sidebar">
      <Link to="/" className="brand"><span className="brand-symbol"><CircleDot size={24} /></span><span>ZE <span className="text-lime">PADEL</span><small>GESTION DES TOURNOIS</small></span></Link>
      <div className="sidebar-label">VOTRE TOURNOI</div>
      <div className="sidebar-tournament"><div className="flex items-center gap-2"><span className="live-dot" /> P100 · Ze Padel</div><span>TMC 16 · Entrée échelonnée</span></div>
      <nav>{nav.map(item => <Button key={item.to} asChild variant="ghost" className={`nav-item ${path === item.to ? 'nav-active' : ''}`}><Link to={item.to}><item.icon size={18} />{item.title}{item.to === '/equipes' && <span className="nav-count">16</span>}</Link></Button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-rule"><Shuffle size={17} /><span>Tirage par rang<small>4 groupes · 16 équipes</small></span></div><div className="sidebar-account"><span className="account-avatar">{user ? (user.email?.[0] ?? 'O').toUpperCase() : 'JA'}</span><div>{user ? 'Mon espace' : 'Juge-arbitre'}<small>{user ? 'Tournoi personnel' : 'Mode essai'}</small></div>{user && <Button variant="ghost" size="icon" title="Se déconnecter" aria-label="Se déconnecter" onClick={() => supabase.auth.signOut()}><LogOut /></Button>}</div></div>
    </aside>
    <div className="app-main"><header className="topbar"><span>Mes tournois <span className="breadcrumb-divider">/</span> <strong>P100 · Ze Padel</strong></span><div className="flex items-center gap-3"><span className="save-status">{busy ? 'Enregistrement…' : dirty ? 'Modifications non enregistrées' : user ? 'À jour' : 'Mode essai'}</span><Button variant="outline" size="sm" disabled={busy} onClick={() => user ? save() : setLogin(true)}><Save />{user ? 'Enregistrer' : 'Se connecter'}</Button></div></header>
      <main><section className="tournament-cover"><img src={court} width={1536} height={512} alt="Terrain de padel avec raquette et balles" /><div className="cover-shade" /><div className="cover-content"><span className="category-label">P100 <span>TOURNOI MULTI-CHANCES</span></span><h1>Ze Padel</h1><div className="cover-details"><span><CalendarDays size={15} />7 juillet 2025</span><span><MapPin size={15} />Ze Padel</span><span><Users size={15} />16 équipes</span></div></div><span className="cover-tag"><span className="live-dot" />{Object.keys(state.results).length === 28 ? 'Terminé' : Object.keys(state.results).length ? 'En cours' : 'À préparer'}</span></section>
      {notice && <p className="notice" role="status">{notice}</p>}
      {children}
      <footer className="app-footer"><span>Ze Padel · P100 · 16 équipes</span><span>Entrée échelonnée <ArrowUpRight size={13} /></span></footer></main>
    </div>
    {login && <div className="modal-backdrop" onClick={() => setLogin(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" className="modal-close" aria-label="Fermer" onClick={() => setLogin(false)}><X /></Button><span className="modal-eyebrow">VOTRE ESPACE TOURNOI</span><h2 id="login-title">Retrouvez votre tournoi</h2><p className="text-muted-foreground text-sm mb-6">Connectez-vous pour enregistrer vos équipes, le tirage et les résultats.</p><Button className="w-full mb-3" onClick={() => signIn('google')}>Continuer avec Google</Button><Button className="w-full" variant="outline" onClick={() => signIn('lovable')}>Continuer avec Lovable</Button>{authError && <p className="text-destructive mt-4" role="alert">{authError}</p>}</section></div>}
  </div>;
}