import {configDefaults,defineConfig} from "vitest/config";

export default defineConfig({test:{exclude:[...configDefaults.exclude,"backups/**","scripts/postgres-db-target-gate.test.mjs","scripts/barky-acceptance-parser.test.mjs"]}});
