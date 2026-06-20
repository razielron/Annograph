import { Command } from "commander";
import { registerScan } from "./commands/scan.js";
import { registerQuery } from "./commands/query.js";
import { registerInit } from "./commands/init.js";
import { registerUi } from "./commands/ui.js";
import { setLogLevel } from "../util/logger.js";
import { CodevizError } from "../util/errors.js";

export async function main(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("codeviz")
    .description(
      "Static, deterministic extraction of an architecture graph from annotated Python code.",
    )
    .version("0.1.0")
    .option("-v, --verbose", "verbose (debug) logging")
    .option("-q, --quiet", "only print errors")
    .hook("preAction", (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts.verbose) setLogLevel("debug");
      else if (opts.quiet) setLogLevel("error");
    });

  registerScan(program);
  registerQuery(program);
  registerInit(program);
  registerUi(program);

  try {
    await program.parseAsync(argv);
  } catch (err) {
    if (err instanceof CodevizError) {
      console.error(`error: ${err.message}`);
      if (err.hint) console.error(`hint: ${err.hint}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}
