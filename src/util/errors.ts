/** Typed errors so the CLI can render actionable, category-specific messages. */

export class CodevizError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** python3 (>=3.9) could not be located or run. */
export class PythonNotFoundError extends CodevizError {}

/** The Python helper failed or emitted unparseable output. */
export class ExtractError extends CodevizError {}

/** codeviz.config.* is malformed or references unknown values. */
export class ConfigError extends CodevizError {}
