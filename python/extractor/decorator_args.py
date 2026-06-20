"""Static, side-effect-free reading of decorator arguments (spec P2).

We never ``eval`` or import user code. Literals are read via ``ast.literal_eval``;
type references (Name/Attribute) are captured as their source string; anything
else is recorded as "unresolved" so the TS side can warn rather than guess.
"""

from __future__ import annotations

import ast
from typing import Any, Optional

from .annotations import render_type_ref


# Sentinel returned for an argument value that is not statically evaluable.
class _Unresolved:
    __slots__ = ()


UNRESOLVED = _Unresolved()


def _eval_value(node: ast.expr) -> tuple[Any, bool, bool]:
    """Return (value, is_type_ref, is_resolved).

    A *type ref* is a Name/Attribute used as an argument (e.g. input=Order); we
    capture its rendered name. A *literal* is anything literal_eval accepts.
    """
    if isinstance(node, (ast.Name, ast.Attribute, ast.Subscript)):
        rendered = render_type_ref(node)
        return (rendered, True, rendered is not None)
    try:
        return (ast.literal_eval(node), False, True)
    except (ValueError, SyntaxError, TypeError):
        return (None, False, False)


def parse_decorator(node: ast.expr) -> Optional[dict]:
    """Parse a single decorator expression into the envelope dict shape.

    Returns ``None`` for decorators that are not call-or-name forms we model.
    """
    line = getattr(node, "lineno", 0)

    # Bare decorator: @component or @cv.component (no call).
    if isinstance(node, ast.Name):
        return _decorator_dict(node.id, None, [], {}, [], [], line)
    if isinstance(node, ast.Attribute):
        return _decorator_dict(node.attr, _qualifier(node.value), [], {}, [], [], line)

    if not isinstance(node, ast.Call):
        return None

    func = node.func
    if isinstance(func, ast.Name):
        name, qualifier = func.id, None
    elif isinstance(func, ast.Attribute):
        name, qualifier = func.attr, _qualifier(func.value)
    else:
        return None

    args: list[Any] = []
    unresolved: list[str] = []
    for i, arg in enumerate(node.args):
        value, _is_ref, resolved = _eval_value(arg)
        args.append(value)
        if not resolved:
            unresolved.append(f"#{i}")

    kwargs: dict[str, Any] = {}
    type_ref_kwargs: list[str] = []
    for kw in node.keywords:
        if kw.arg is None:  # **kwargs splat — not statically analyzable
            unresolved.append("**")
            continue
        value, is_ref, resolved = _eval_value(kw.value)
        kwargs[kw.arg] = value
        if is_ref:
            type_ref_kwargs.append(kw.arg)
        if not resolved:
            unresolved.append(kw.arg)

    return _decorator_dict(name, qualifier, args, kwargs, type_ref_kwargs, unresolved, line)


def _qualifier(node: ast.expr) -> Optional[str]:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        inner = _qualifier(node.value)
        return f"{inner}.{node.attr}" if inner else node.attr
    return None


def _decorator_dict(
    name: str,
    qualifier: Optional[str],
    args: list[Any],
    kwargs: dict[str, Any],
    type_ref_kwargs: list[str],
    unresolved_kwargs: list[str],
    line: int,
) -> dict:
    return {
        "name": name,
        "qualifier": qualifier,
        "args": args,
        "kwargs": kwargs,
        "type_ref_kwargs": type_ref_kwargs,
        "unresolved_kwargs": unresolved_kwargs,
        "line": line,
    }
