"""codeviz Python AST extractor — entry point.

Spawned by the TypeScript CLI. Reads a JSON request on stdin:

    { "root": "/abs/project/root", "files": ["/abs/.../a.py", ...] }

Emits NDJSON on stdout: one ModuleEnvelope per file, then a final summary line.
Per-file errors are captured in the envelope (non-fatal) so one bad file does
not abort the scan. stdlib only; no third-party imports; no user code executed.
"""

from __future__ import annotations

import json
import os
import sys

# Support both `python -m extractor.main` and `python path/to/main.py`.
if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from extractor.emit import ModuleEnvelope, ParseError, dump_line, HELPER_VERSION  # noqa: E402
    from extractor.walker import extract_module, path_to_dotted  # noqa: E402
else:
    from .emit import ModuleEnvelope, ParseError, dump_line, HELPER_VERSION
    from .walker import extract_module, path_to_dotted


def _relativize(root: str, file_path: str) -> str:
    try:
        rel = os.path.relpath(file_path, root)
    except ValueError:
        rel = file_path
    return rel.replace("\\", "/")


def run(request: dict, out) -> None:
    root = request.get("root") or os.getcwd()
    files = request.get("files") or []

    parsed = 0
    errored = 0

    for file_path in files:
        rel = _relativize(root, file_path)
        try:
            with open(file_path, "r", encoding="utf-8") as fh:
                source = fh.read()
        except OSError as exc:
            errored += 1
            env = ModuleEnvelope(
                type="module",
                path=rel,
                module_dotted=path_to_dotted(rel),
                parse_error=ParseError(message=f"could not read file: {exc}"),
            )
            out.write(dump_line(env) + "\n")
            continue

        env = extract_module(rel, source)
        if env.parse_error is not None:
            errored += 1
        else:
            parsed += 1
        out.write(dump_line(env) + "\n")

    summary = {
        "type": "summary",
        "files_total": len(files),
        "files_parsed": parsed,
        "files_errored": errored,
        "python_version": ".".join(str(v) for v in sys.version_info[:3]),
        "helper_version": HELPER_VERSION,
    }
    out.write(dump_line(summary) + "\n")
    out.flush()


def main() -> int:
    raw = sys.stdin.read()
    try:
        request = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as exc:
        sys.stderr.write(f"invalid request JSON: {exc}\n")
        return 2
    run(request, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
