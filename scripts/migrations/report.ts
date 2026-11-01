// Rapport lisible d'une simulation de migration des identités.
import { displayName } from "@/lib/domain/names";
import type { MigrationPlan } from "@/lib/server/migrations/identities";

export function renderReport(plan: MigrationPlan, target: string): string {
  const lines = [
    `# Simulation — identités de l'édition ${plan.eventId}`,
    "",
    `Base : ${target}. Empreinte : \`${plan.fingerprint}\`. **Aucune écriture effectuée.**`,
    "",
    "## Chiffres",
    "",
    ...Object.entries(plan.stats).map(([key, value]) => `- ${key} : ${value}`),
    "",
    "## Points à arbitrer",
    "",
  ];
  const byKind = new Map<string, string[]>();
  plan.issues.forEach(issue => byKind.set(issue.kind, [...(byKind.get(issue.kind) ?? []), issue.message]));
  for (const [kind, messages] of byKind) {
    lines.push(`### ${kind} (${messages.length})`, "", ...messages.map(message => `- ${message}`), "");
  }
  lines.push("## Participants prévus", "", "| Dossard | Participant | Saisie d'origine | Créneaux | Remarque |", "|---|---|---|---|---|");
  for (const participant of [...plan.participants].sort((a, b) => (a.bib ?? 9999) - (b.bib ?? 9999))) {
    const remark = [participant.renamedBy ? `corrigé : ${participant.renamedBy}` : "", participant.withdrawn ? "retiré du planning" : ""].filter(Boolean).join(" ; ");
    lines.push(`| ${participant.bib ?? "—"} | ${displayName(participant.name)} | ${displayName(participant.enteredAs)} | ${participant.slotIds.length} | ${remark} |`);
  }
  lines.push("", "## Équipes prévues", "", "| Dossard | Membres | Statut | Nom publié |", "|---|---|---|---|");
  const names = new Map(plan.participants.map(participant => [participant.id, displayName(participant.name)]));
  for (const team of plan.teams) {
    lines.push(`| ${team.bib ?? "—"} | ${team.memberIds.map(id => names.get(id)).join(" – ")} | ${team.status} | ${team.displayName ?? ""} |`);
  }
  return lines.join("\n") + "\n";
}
