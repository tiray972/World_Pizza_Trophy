// Lance les tests dans l'émulateur Firestore officiel.
// L'émulateur demande Java 11+ : on utilise le JDK Homebrew s'il n'y en a pas d'autre.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const env = { ...process.env };
const homebrewJdk = "/opt/homebrew/opt/openjdk@21";
if (!env.JAVA_HOME && existsSync(homebrewJdk)) {
  env.JAVA_HOME = homebrewJdk;
  env.PATH = `${homebrewJdk}/bin:${env.PATH}`;
}

const vitestArgs = process.argv.slice(2).join(" ");
const result = spawnSync(
  "npx",
  ["firebase", "emulators:exec", "--only", "firestore", "--project", "demo-wpt", `npx vitest run ${vitestArgs}`],
  { stdio: "inherit", env }
);
process.exit(result.status ?? 1);
