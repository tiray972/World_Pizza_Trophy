'use client';

// Historique sportif du compte : éditions, catégories, équipes et résultats
// publiés des participants inscrits par ce compte. Noms propres jamais traduits.

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { AccountHistoryEdition } from '@/lib/server/participants/history';

const TEXTS = {
  fr: { title: 'Mes éditions et résultats', empty: 'Aucune participation enregistrée pour ce compte.', bib: 'Dossard', categories: 'Catégories', team: 'Équipe', results: 'Résultats publiés', none: 'Pas encore de résultat publié.', rank: 'Rang', points: 'points', status: { absent: 'Absent', dnf: 'Abandon', dsq: 'Disqualifié' } as Record<string, string>, loading: 'Chargement de l’historique…', error: 'Historique indisponible pour le moment.' },
  en: { title: 'My editions and results', empty: 'No participation recorded for this account.', bib: 'Bib', categories: 'Categories', team: 'Team', results: 'Published results', none: 'No published result yet.', rank: 'Rank', points: 'points', status: { absent: 'Absent', dnf: 'Withdrew', dsq: 'Disqualified' } as Record<string, string>, loading: 'Loading history…', error: 'History unavailable for now.' },
  es: { title: 'Mis ediciones y resultados', empty: 'No hay participaciones registradas para esta cuenta.', bib: 'Dorsal', categories: 'Categorías', team: 'Equipo', results: 'Resultados publicados', none: 'Aún no hay resultados publicados.', rank: 'Puesto', points: 'puntos', status: { absent: 'Ausente', dnf: 'Abandono', dsq: 'Descalificado' } as Record<string, string>, loading: 'Cargando el historial…', error: 'Historial no disponible por el momento.' },
  it: { title: 'Le mie edizioni e risultati', empty: 'Nessuna partecipazione registrata per questo account.', bib: 'Pettorale', categories: 'Categorie', team: 'Squadra', results: 'Risultati pubblicati', none: 'Nessun risultato ancora pubblicato.', rank: 'Posizione', points: 'punti', status: { absent: 'Assente', dnf: 'Ritirato', dsq: 'Squalificato' } as Record<string, string>, loading: 'Caricamento dello storico…', error: 'Storico non disponibile al momento.' },
};

export function AccountHistory({ user, lang, viewedUid }: { user: User; lang: string; viewedUid?: string | null }) {
  const t = TEXTS[(lang in TEXTS ? lang : 'fr') as keyof typeof TEXTS];
  const [editions, setEditions] = useState<AccountHistoryEdition[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    user
      .getIdToken()
      .then(token => fetch(`/api/account/history${viewedUid ? `?uid=${encodeURIComponent(viewedUid)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }))
      .then(response => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: { editions: AccountHistoryEdition[] }) => !cancelled && setEditions(data.editions))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [user, viewedUid]);

  return (
    <section aria-labelledby="account-history-title" className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
      <h2 id="account-history-title" className="text-xl font-bold">{t.title}</h2>
      {failed ? (
        <p className="mt-3 text-sm text-gray-600">{t.error}</p>
      ) : editions === null ? (
        <p className="mt-3 text-sm text-gray-600" role="status">{t.loading}</p>
      ) : editions.length === 0 ? (
        <p className="mt-3 text-sm text-gray-600">{t.empty}</p>
      ) : (
        <div className="mt-4 space-y-6">
          {editions.map(edition => (
            <div key={edition.eventId}>
              <h3 className="text-lg font-semibold">{edition.eventName}</h3>
              <ul className="mt-2 space-y-3">
                {edition.participants.map((participant, index) => (
                  <li key={index} className="rounded-lg border border-gray-200 p-3">
                    <p className="font-semibold">
                      {participant.name}
                      {participant.bib !== null && <span className="ml-2 text-sm font-normal text-gray-600">{t.bib} {participant.bib}</span>}
                    </p>
                    {participant.categories.length > 0 && <p className="text-sm text-gray-700">{t.categories} : {participant.categories.join(', ')}</p>}
                    {participant.teams.map((team, teamIndex) => (
                      <p key={teamIndex} className="text-sm text-gray-700">
                        {t.team} {team.category}{team.bib !== null ? ` (${t.bib} ${team.bib})` : ''} : {team.members.join(' – ')}
                      </p>
                    ))}
                    <p className="mt-1 text-sm font-medium">{t.results}</p>
                    {participant.results.length === 0 ? (
                      <p className="text-sm text-gray-500">{t.none}</p>
                    ) : (
                      <ul className="text-sm text-gray-700">
                        {participant.results.map((result, resultIndex) => (
                          <li key={resultIndex}>
                            {result.category} : {result.rank !== null ? `${t.rank} ${result.rank}` : t.status[result.status] ?? result.status}
                            {result.points !== null ? ` · ${result.points.toLocaleString(lang)} ${t.points}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
