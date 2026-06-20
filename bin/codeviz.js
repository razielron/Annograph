#!/usr/bin/env node
import { main } from "../dist/cli/index.js";

main(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
