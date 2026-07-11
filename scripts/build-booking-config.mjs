// Regenerates js/booking-config.js from .env — run after updating STAAH URLs.
//   node scripts/build-booking-config.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
try {
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  console.error("No .env found — copy .env.example to .env first.");
  process.exit(1);
}

const prop = (key, name) => ({
  name,
  staahEnabled: (env[`STAAH_${key}_ENABLED`] || "false").toLowerCase() === "true",
  staahUrl: env[`STAAH_${key}_URL`] || "",
});

const config = {
  inn: prop("INN", "Hotel Chinmaye Inn"),
  grand: prop("GRAND", "The Chinmaye Grand"),
  deoghar: prop("DEOGHAR", "Chinmaye Deoghar"),
};

const banner = `/* Chinmaye Hotels — booking engine configuration.
   GENERATED FILE — do not put secrets here.
   Run \`node scripts/build-booking-config.mjs\` after editing .env
   (see .env.example) to regenerate with real STAAH URLs. */
`;
writeFileSync(
  join(root, "js/booking-config.js"),
  banner + "window.CHINMAYE_CONFIG = " + JSON.stringify(config, null, 2) + ";\n"
);
console.log("js/booking-config.js regenerated:", JSON.stringify(config));
