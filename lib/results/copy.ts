export const resultsCopy = {
  fr: { title: "Résultats 2026", intro: "Retrouvez les classements du Trophée Mondial de la Pizza des 27 et 28 octobre 2026 à Menton.", available: "{count} classements publiés. Les autres catégories seront ajoutées lorsque leurs résultats seront disponibles.", categories: "Choisir un classement", rank: "Rang", name: "Participant", team: "Duo", bib: "Dossard", points: "Points", teams: "Classement des duos", individual: "Classement individuel", top: "Retour en haut", source: "Voir la publication des résultats", editions: "Les éditions précédentes", status: { absent: "Absent", dnf: "Abandon", dsq: "Disqualifié" }, updated: "Mis à jour le", members: "Équipiers" },
  en: { title: "2026 results", intro: "Explore the World Pizza Trophy rankings from 27 and 28 October 2026 in Menton.", available: "{count} published rankings. Other categories will be added when their results are available.", categories: "Choose a ranking", rank: "Rank", name: "Participant", team: "Duo", bib: "Bib", points: "Points", teams: "Duo ranking", individual: "Individual ranking", top: "Back to top", source: "View the results announcement", editions: "Previous editions", status: { absent: "Absent", dnf: "Withdrew", dsq: "Disqualified" }, updated: "Updated on", members: "Team members" },
  es: { title: "Resultados 2026", intro: "Consulta las clasificaciones del World Pizza Trophy del 27 y 28 de octubre de 2026 en Menton.", available: "{count} clasificaciones publicadas. Las demás categorías se añadirán cuando sus resultados estén disponibles.", categories: "Elegir una clasificación", rank: "Puesto", name: "Participante", team: "Dúo", bib: "Dorsal", points: "Puntos", teams: "Clasificación de dúos", individual: "Clasificación individual", top: "Volver arriba", source: "Ver la publicación de los resultados", editions: "Ediciones anteriores", status: { absent: "Ausente", dnf: "Abandono", dsq: "Descalificado" }, updated: "Actualizado el", members: "Integrantes" },
  it: { title: "Risultati 2026", intro: "Scopri le classifiche del World Pizza Trophy del 27 e 28 ottobre 2026 a Mentone.", available: "{count} classifiche pubblicate. Le altre categorie saranno aggiunte quando i risultati saranno disponibili.", categories: "Scegli una classifica", rank: "Posizione", name: "Partecipante", team: "Duo", bib: "Pettorale", points: "Punti", teams: "Classifica a coppie", individual: "Classifica individuale", top: "Torna in alto", source: "Vedi la pubblicazione dei risultati", editions: "Edizioni precedenti", status: { absent: "Assente", dnf: "Ritirato", dsq: "Squalificato" }, updated: "Aggiornato il", members: "Componenti" },
};
export type ResultsLocale = keyof typeof resultsCopy;
export function resultLocale(value: string): ResultsLocale {
  return value === "en" || value === "es" || value === "it" ? value : "fr";
}
const labels: Record<string, Record<ResultsLocale, string>> = {
  classique: {fr:"Pizza Classique",en:"Classic Pizza",es:"Pizza Clásica",it:"Pizza Classica"},
  napolitaine: {fr:"Napolitaine",en:"Neapolitan",es:"Napolitana",it:"Napoletana"},
  dessert: {fr:"Pizza Dessert",en:"Dessert Pizza",es:"Pizza de Postre",it:"Pizza Dessert"},
  "super-champion": {fr:"Super Champion",en:"Super Champion",es:"Supercampeón",it:"Super Campione"},
};
export function categoryLabel(id: string, fallback: string, lang: ResultsLocale) {
  return labels[id]?.[lang] ?? fallback;
}
