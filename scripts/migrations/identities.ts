// Migration des identités d'une édition. SIMULATION PAR DÉFAUT.
//
//   Simulation (lecture seule) :
//     npx vite-node --config vitest.config.ts scripts/migrations/identities.ts -- --event <eventId>
//   Application (après relecture du rapport) :
//     ... -- --event <eventId> --apply --fingerprint <empreinte du rapport> --actor <uid admin>
//
// Base visée : FIRESTORE_EMULATOR_HOST (émulateur) ou GOOGLE_APPLICATION_CREDENTIALS
// (compte de service, production). Le rapport est écrit dans output/migrations/
// (non versionné : il contient des noms de personnes).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { applyIdentityMigration, planIdentityMigration, type MigrationDecisions } from "@/lib/server/migrations/identities";
import { references2026 } from "./references-2026";
import { renderReport } from "./report";

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

async function main() {
  const eventId = option("event");
  if (!eventId) throw new Error("--event <eventId> obligatoire");
  const projectId = option("project") ?? process.env.GCLOUD_PROJECT ?? "demo-wpt";
  const app = process.env.FIRESTORE_EMULATOR_HOST
    ? initializeApp({ projectId })
    : initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore(app);
  const decisions = JSON.parse(readFileSync(path.resolve(__dirname, "2026-decisions.json"), "utf8")) as MigrationDecisions;
  const references = references2026();
  const target = process.env.FIRESTORE_EMULATOR_HOST ? `émulateur ${process.env.FIRESTORE_EMULATOR_HOST}` : `PROJET ${projectId}`;

  if (args.includes("--apply")) {
    const fingerprint = option("fingerprint");
    const actor = option("actor");
    if (!fingerprint || !actor) throw new Error("--apply exige --fingerprint et --actor");
    const result = await applyIdentityMigration(db, eventId, { references, decisions, fingerprint, actor: { uid: actor, displayName: "migration identités" } });
    console.log(`✅ Migration appliquée sur ${target} : ${result.writes} écriture(s).`);
    return;
  }

  const plan = await planIdentityMigration(db, eventId, { references, decisions });
  const outDir = path.resolve(__dirname, "../../output/migrations");
  mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, `identities-${eventId}-${plan.fingerprint}`);
  writeFileSync(`${base}.json`, JSON.stringify(plan, null, 2));
  writeFileSync(`${base}.md`, renderReport(plan, target));
  console.log(`🔎 Simulation sur ${target} — aucune écriture.`);
  console.log(JSON.stringify(plan.stats));
  console.log(`Rapport : ${base}.md`);
  console.log(`Empreinte : ${plan.fingerprint}`);
}

main().catch(error => {
  console.error("❌", error instanceof Error ? error.message : error);
  process.exit(1);
});
