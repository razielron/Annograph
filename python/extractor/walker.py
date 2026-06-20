"""AST walker producing one ModuleEnvelope per Python source file.

Captures Tier-A skeleton facts (classes, functions, imports, bases, call sites)
plus the raw decorator/annotation data the TS side needs for Tier-B contracts
and layer assignment. Resolution of ids/edges happens entirely in TypeScript.
"""

from __future__ import annotations

import ast
from typing import Optional

from .annotations import render_type_ref
from .decorator_args import parse_decorator
from .emit import (
    Base,
    Call,
    Class,
    Func,
    Import,
    ImportName,
    InstanceAttr,
    ModuleEnvelope,
    Param,
    ParseError,
)


def path_to_dotted(rel_path: str) -> str:
    """Convert a relative path like 'domain/order_service.py' -> 'domain.order_service'."""
    p = rel_path.replace("\\", "/")
    if p.endswith(".py"):
        p = p[:-3]
    if p.endswith("/__init__"):
        p = p[: -len("/__init__")]
    return p.strip("/").replace("/", ".")


def extract_module(rel_path: str, source: str) -> ModuleEnvelope:
    module_dotted = path_to_dotted(rel_path)
    try:
        tree = ast.parse(source, filename=rel_path)
    except SyntaxError as exc:
        return ModuleEnvelope(
            type="module",
            path=rel_path,
            module_dotted=module_dotted,
            parse_error=ParseError(message=str(exc.msg), line=exc.lineno),
        )

    env = ModuleEnvelope(type="module", path=rel_path, module_dotted=module_dotted)

    for node in tree.body:
        if isinstance(node, ast.Import):
            for alias in node.names:
                env.imports.append(
                    Import(
                        kind="import",
                        module=alias.name,
                        names=[ImportName(name=alias.name, asname=alias.asname)],
                        level=0,
                    )
                )
        elif isinstance(node, ast.ImportFrom):
            env.imports.append(
                Import(
                    kind="from",
                    module=node.module,
                    names=[ImportName(name=a.name, asname=a.asname) for a in node.names],
                    level=node.level or 0,
                )
            )
        elif isinstance(node, ast.ClassDef):
            env.classes.append(_extract_class(node))
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            env.functions.append(_extract_func(node))

    env.module_calls = _collect_calls_outside_defs(tree.body)
    return env


def _extract_class(node: ast.ClassDef) -> Class:
    bases = [_render_base(b) for b in node.bases]
    decorators = _decorators(node.decorator_list)
    methods: list[Func] = []
    instance_attrs: dict[str, InstanceAttr] = {}

    for item in node.body:
        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
            methods.append(_extract_func(item))
            if item.name == "__init__":
                param_types = {
                    a.arg: render_type_ref(a.annotation) for a in item.args.args if a.annotation
                }
                _collect_instance_attrs(item, instance_attrs, param_types)

    return Class(
        name=node.name,
        line=node.lineno,
        bases=bases,
        decorators=decorators,
        methods=methods,
        instance_attrs=list(instance_attrs.values()),
    )


def _extract_func(node: ast.FunctionDef | ast.AsyncFunctionDef) -> Func:
    params = [Param(name=a.arg, annotation=render_type_ref(a.annotation)) for a in node.args.args]
    decorators = _decorators(node.decorator_list)
    is_property = any(d["name"] == "property" for d in decorators)
    return Func(
        name=node.name,
        line=node.lineno,
        decorators=decorators,
        params=params,
        returns=render_type_ref(node.returns),
        calls=_collect_calls(node),
        is_property=is_property,
    )


def _decorators(decorator_list: list[ast.expr]) -> list[dict]:
    result = []
    for dec in decorator_list:
        parsed = parse_decorator(dec)
        if parsed is not None:
            result.append(parsed)
    return result


def _render_base(node: ast.expr) -> Base:
    if isinstance(node, ast.Name):
        return Base(expr=node.id, kind="name")
    if isinstance(node, ast.Attribute):
        return Base(expr=render_type_ref(node) or node.attr, kind="attribute")
    return Base(expr=render_type_ref(node) or "<expr>", kind="other")


def _attr_chain(node: ast.expr) -> Optional[list[str]]:
    """Flatten an attribute/name expression to its dotted segments, or None."""
    parts: list[str] = []
    cur: ast.expr = node
    while isinstance(cur, ast.Attribute):
        parts.append(cur.attr)
        cur = cur.value
    if isinstance(cur, ast.Name):
        parts.append(cur.id)
        parts.reverse()
        return parts
    return None


def _make_call(call: ast.Call) -> Optional[Call]:
    func = call.func
    chain = _attr_chain(func)
    if chain is None:
        return None
    if len(chain) == 1:
        return Call(
            callee_repr=chain[0],
            kind="name",
            attr_chain=chain,
            root=chain[0],
            line=getattr(call, "lineno", 0),
        )
    return Call(
        callee_repr=".".join(chain),
        kind="attribute",
        attr_chain=chain,
        root=chain[0],
        line=getattr(call, "lineno", 0),
    )


def _collect_calls(node: ast.FunctionDef | ast.AsyncFunctionDef) -> list[Call]:
    """Collect every call site inside a function body (skipping nested defs).

    Only the function *body* is visited: decorators, default values, and
    annotations on the def itself are not call edges of this function.
    """
    calls: list[Call] = []

    class _Visitor(ast.NodeVisitor):
        def visit_Call(self, n: ast.Call) -> None:  # noqa: N802
            made = _make_call(n)
            if made is not None:
                calls.append(made)
            self.generic_visit(n)

        # Do not descend into nested function/class defs; they get their own nodes.
        def visit_FunctionDef(self, n: ast.FunctionDef) -> None:  # noqa: N802
            pass

        def visit_AsyncFunctionDef(self, n: ast.AsyncFunctionDef) -> None:  # noqa: N802
            pass

        def visit_ClassDef(self, n: ast.ClassDef) -> None:  # noqa: N802
            pass

    for stmt in node.body:
        _Visitor().visit(stmt)
    return calls


def _collect_calls_outside_defs(body: list[ast.stmt]) -> list[Call]:
    calls: list[Call] = []
    for stmt in body:
        if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue
        for node in ast.walk(stmt):
            if isinstance(node, ast.Call):
                made = _make_call(node)
                if made is not None:
                    calls.append(made)
    return calls


def _collect_instance_attrs(
    init_fn: ast.FunctionDef | ast.AsyncFunctionDef,
    out: dict[str, InstanceAttr],
    param_types: dict[str, Optional[str]],
) -> None:
    """Infer self.<attr> types from __init__ assignments/annotations.

    Handles:
      - self.x: InventoryService          (annotated assignment)
      - self.x = InventoryService(...)     (constructor call -> the class name)
      - self.x = inventory                 (assigned from an annotated param -> its type)
      - self.x = SomeName                  (alias to a name -> that name)
    """
    for stmt in ast.walk(init_fn):
        if isinstance(stmt, ast.AnnAssign) and _is_self_attr(stmt.target):
            name = stmt.target.attr  # type: ignore[union-attr]
            type_ref = render_type_ref(stmt.annotation)
            out.setdefault(name, InstanceAttr(name=name, type_ref=type_ref, line=stmt.lineno))
        elif isinstance(stmt, ast.Assign):
            for target in stmt.targets:
                if _is_self_attr(target):
                    name = target.attr  # type: ignore[union-attr]
                    type_ref = _infer_assign_type(stmt.value, param_types)
                    if name not in out:
                        out[name] = InstanceAttr(name=name, type_ref=type_ref, line=stmt.lineno)


def _is_self_attr(node: ast.expr) -> bool:
    return (
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id == "self"
    )


def _infer_assign_type(value: ast.expr, param_types: dict[str, Optional[str]]) -> Optional[str]:
    # self.x = Foo(...) -> "Foo" (or dotted "pkg.Foo")
    if isinstance(value, ast.Call):
        return render_type_ref(value.func)
    # self.x = inventory -> the param's declared type, if any; else the name itself.
    if isinstance(value, ast.Name):
        return param_types.get(value.id) or value.id
    if isinstance(value, ast.Attribute):
        return render_type_ref(value)
    return None
