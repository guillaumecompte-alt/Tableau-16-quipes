import { useRef, useState } from 'react';
import { Upload, X, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { importedTournament, parseParticipantRows } from '@/lib/padel/team-import';
import type { Team } from '@/lib/padel/tournament';
import { useTournament } from './use-tournament';

export function TeamImportDialog({ onImported }: { onImported: () => void }) {
  const { update, busy } = useTournament();
  const input = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ filename: string; teams: Team[] } | null>(null);
  async function readFile(file: File) {
    setError(''); setPreview(null); setLoading(true);
    try {
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Choisissez un fichier Excel .xlsx ou .xls.');
      if (file.size > 5 * 1024 * 1024) throw new Error('Le fichier dépasse la limite de 5 Mo.');
      const { read, utils } = await import('xlsx');
      const workbook = read(await file.arrayBuffer(), { type: 'array', cellFormula: false, cellHTML: false, sheetRows: 1000 });
      const sheets = workbook.SheetNames.map(name => workbook.Sheets[name]).filter(sheet => sheet !== undefined);
      let teams: Team[] | undefined;
      let lastError = 'Aucune liste de participants trouvée.';
      for (const sheet of sheets) {
        const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
        try { teams = parseParticipantRows(rows); break; }
        catch (caught) { lastError = caught instanceof Error ? caught.message : lastError; if (rows.some(row => row.some(cell => String(cell).toLowerCase().trim() === 'position de la paire'))) throw caught; }
      }
      if (!teams) throw new Error(lastError);
      setPreview({ filename: file.name, teams });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Impossible de lire ce fichier Excel.'); }
    finally { setLoading(false); if (input.current) input.current.value = ''; }
  }
  return <>
    <input ref={input} type="file" accept=".xlsx,.xls" className="hidden" aria-label="Fichier de participants Excel" onChange={event => { const file = event.target.files?.[0]; if (file) void readFile(file); }} />
    <Button disabled={busy || loading} onClick={() => input.current?.click()}><Upload />{loading ? 'Lecture…' : 'Importer Excel'}</Button>
    {error && <p className="text-destructive text-sm w-full" role="alert">{error}</p>}
    {preview && <div className="modal-backdrop"><section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <Button variant="ghost" size="icon" className="modal-close" aria-label="Fermer" onClick={() => setPreview(null)}><X /></Button>
      <span className="modal-eyebrow break-all">{preview.filename}</span><h2 id="import-title">{preview.teams.length} paires à importer</h2>
      <div className="table-scroll import-preview"><table className="teams-table"><thead><tr><th>Rang</th><th>Joueur 1</th><th>Joueur 2</th><th>Classements</th></tr></thead><tbody>{preview.teams.map(team => <tr key={team.rank}><td>{team.rank}</td><td>{team.player1}</td><td>{team.player2}</td><td>{team.ranking1} / {team.ranking2}</td></tr>)}</tbody></table></div>
      {preview.teams.length < 16 && <p className="text-sm text-muted-foreground mt-4">{16 - preview.teams.length} paires resteront à compléter avant le tirage.</p>}
      <p className="text-sm text-muted-foreground mt-3">Convocations non renseignées dans ce fichier. Coordonnées, licences et dates de naissance non importées.</p>
      <p className="import-warning"><AlertTriangle size={18} />La liste actuelle sera remplacée. Le tirage et les résultats seront effacés.</p>
      <div className="flex flex-wrap justify-end gap-3 mt-5"><Button variant="outline" onClick={() => setPreview(null)}>Annuler</Button><Button disabled={busy} onClick={() => { update(importedTournament(preview.teams)); setPreview(null); onImported(); }}><Check />Confirmer l’import</Button></div>
    </section></div>}
  </>;
}