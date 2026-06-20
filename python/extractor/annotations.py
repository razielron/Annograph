"""Render type-reference AST nodes to stable strings (Tier B).

We only need the type *name* for Tier B contracts, so we unparse annotation
expressions to a normalized source string. ``ast.unparse`` requires Python 3.9+.
"""

from __future__ import annotations

import ast
from typing import Optional


def render_type_ref(node: Optional[ast.expr]) -> Optional[str]:
    """Render a type expression (Name, Attribute, Subscript, ...) to a string.

    Returns None for missing or non-renderable annotations.
    """
    if node is None:
        return None
    try:
        return ast.unparse(node)
    except Exception:  # pragma: no cover - defensive; unparse is robust on 3.9+
        return None
