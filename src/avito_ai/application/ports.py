from collections.abc import Sequence
from typing import Protocol
from uuid import UUID

from avito_ai.domain.models import CatalogItem, ListingDraft, Workflow


class WorkflowRepository(Protocol):
    async def add(self, workflow: Workflow) -> None: ...
    async def get(self, workflow_id: UUID) -> Workflow | None: ...
    async def save(self, workflow: Workflow) -> None: ...


class CatalogAgent(Protocol):
    async def discover(self, website_url: str) -> Sequence[CatalogItem]: ...


class CopyAgent(Protocol):
    async def create(self, item: CatalogItem, market: str) -> ListingDraft: ...
