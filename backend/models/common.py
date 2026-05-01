from typing import Generic, List, TypeVar

from pydantic import BaseModel, ConfigDict


def _to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0].lower() + "".join(p.capitalize() for p in parts[1:])


T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)
    success: bool = True
    data: T | None = None
    message: str | None = None
    errors: List[str] | None = None
