"""codeviz — inert annotation decorators for static code visualization."""

from .decorators import (
    boundary,
    component,
    contract,
    entrypoint,
    link,
    pattern,
    uses_service,
)

__all__ = [
    "component",
    "contract",
    "uses_service",
    "entrypoint",
    "boundary",
    "pattern",
    "link",
]
