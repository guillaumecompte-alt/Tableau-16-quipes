import { createFileRoute } from "@tanstack/react-router";
import { TournamentShell } from '@/components/padel/tournament-shell';
import { TournamentBoard } from '@/components/padel/tournament-board';
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: 'Ze Padel · Tableau du tournoi | Padel Board' },
    { name: 'description', content: 'Tournoi P100 à 16 équipes : tirage par rang, résultats et parcours de classement.' },
    { property: 'og:title', content: 'Ze Padel · Tableau du tournoi' },
    { property: 'og:description', content: 'Le tableau à entrée échelonnée du tournoi P100 Ze Padel.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Index,
});
function Index() {
  return <TournamentShell><TournamentBoard /></TournamentShell>;
}
