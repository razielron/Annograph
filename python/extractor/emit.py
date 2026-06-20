"""Envelope dataclasses and JSON serialization for the codeviz AST helper.

The helper emits NDJSON: one ``module`` object per line, then a final ``summary``
line. These are *file-local raw facts* only -- no node ids, no layer assignment.
Those are global concerns owned by the TypeScript side. Keeping this module a
pure data carrier makes the Python<->TS contract explicit and testable.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

HELPER_VERSION = "0.1.0"


@dataclass
class ImportName:
    name: str
    asname: Optional[str] = None


@dataclass
class Import:
    # "import" for `import x [as y]`; "from" for `from m import a [as b]`.
    kind: str
    module: Optional[str]
    names: list[ImportName] = field(default_factory=list)
    # Relative-import depth (number of leading dots); 0 for absolute imports.
    level: int = 0


@dataclass
class Decorator:
    name: str
    # Set when applied as a dotted attribute, e.g. `cv.component` -> "cv".
    qualifier: Optional[str]
    args: list[Any]
    kwargs: dict[str, Any]
    # kwargs whose value is a type reference (Name/Attribute), e.g. input=Order.
    type_ref_kwargs: list[str]
    # kwargs (and positional indices) whose value was NOT statically evaluable.
    unresolved_kwargs: list[str]
    line: int


@dataclass
class Param:
    name: str
    annotation: Optional[str] = None


@dataclass
class Call:
    # Human-readable rendering, e.g. "self.inventory.reserve".
    callee_repr: str
    # "name" for a bare call f(); "attribute" for a.b.c().
    kind: str
    # Dotted segments, e.g. ["self", "inventory", "reserve"].
    attr_chain: list[str]
    # First segment ("self", a module alias, a local name, ...).
    root: str
    line: int


@dataclass
class Base:
    expr: str
    # "name" for `Base`, "attribute" for `abc.ABC`, "other" for anything else.
    kind: str


@dataclass
class InstanceAttr:
    name: str
    # Declared/assigned type ref, e.g. self.inventory: InventoryService
    # or self.inventory = InventoryService(...) -> "InventoryService".
    type_ref: Optional[str]
    line: int


@dataclass
class Func:
    name: str
    line: int
    decorators: list[Decorator] = field(default_factory=list)
    params: list[Param] = field(default_factory=list)
    returns: Optional[str] = None
    calls: list[Call] = field(default_factory=list)
    is_property: bool = False


@dataclass
class Class:
    name: str
    line: int
    bases: list[Base] = field(default_factory=list)
    decorators: list[Decorator] = field(default_factory=list)
    methods: list[Func] = field(default_factory=list)
    instance_attrs: list[InstanceAttr] = field(default_factory=list)


@dataclass
class ParseError:
    message: str
    line: Optional[int] = None


@dataclass
class ModuleEnvelope:
    type: str  # always "module"
    path: str
    module_dotted: str
    parse_error: Optional[ParseError] = None
    imports: list[Import] = field(default_factory=list)
    classes: list[Class] = field(default_factory=list)
    functions: list[Func] = field(default_factory=list)
    module_calls: list[Call] = field(default_factory=list)


def dump_line(obj: Any) -> str:
    """Serialize a dataclass (or dict) to a single compact JSON line."""
    payload = asdict(obj) if hasattr(obj, "__dataclass_fields__") else obj
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
