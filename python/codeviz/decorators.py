"""codeviz annotation decorators — inert, pass-through metadata (spec P2).

Every decorator here changes no behavior and runs no logic: it returns the
decorated object unchanged. Their *arguments* are what the static extractor
reads from the AST; the decorators themselves are never executed by codeviz.

    from codeviz import component, contract, uses_service, entrypoint

    @component(layer="domain", tags=["orders"])
    class OrderService:
        @contract(input=CreateOrderRequest, output=Order, errors=["OutOfStock"])
        @entrypoint(kind="http", path="POST /orders")
        def create_order(self, req): ...
"""

from __future__ import annotations

from typing import Any, Callable, Optional, Sequence, TypeVar

T = TypeVar("T")


def _passthrough(obj: T) -> T:
    return obj


def component(
    layer: Optional[str] = None,
    name: Optional[str] = None,
    tags: Optional[Sequence[str]] = None,
) -> Callable[[T], T]:
    """Declare a node and assign it to an architectural layer."""
    return _passthrough


def contract(
    input: Any = None,  # noqa: A002 - mirrors the spec's keyword name
    output: Any = None,
    errors: Optional[Sequence[str]] = None,
) -> Callable[[T], T]:
    """Attach an input/output contract (type references) to a function."""
    return _passthrough


def uses_service(name: str, op: Optional[str] = None) -> Callable[[T], T]:
    """Mark that this call reaches a third-party service."""
    return _passthrough


def entrypoint(kind: str, path: Optional[str] = None) -> Callable[[T], T]:
    """Mark an entry point (route, CLI, job) — a natural start for flow tracing."""
    return _passthrough


def boundary(note: Optional[str] = None) -> Callable[[T], T]:
    """Mark an interesting integration boundary to highlight in the view."""
    return _passthrough


def pattern(name: str, role: Optional[str] = None) -> Callable[[T], T]:
    """Declare participation in a design pattern (authoritative)."""
    return _passthrough


def link(to: str, kind: Optional[str] = None) -> Callable[[T], T]:
    """Manually declare an edge static analysis cannot see (DI, reflection, ...)."""
    return _passthrough
