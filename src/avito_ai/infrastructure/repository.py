import asyncio
from copy import deepcopy
from uuid import UUID

from avito_ai.domain.models import Workflow


class InMemoryWorkflowRepository:
    """Development adapter; production uses a transactional PostgreSQL adapter."""

    def __init__(self) -> None:
        self._items: dict[UUID, Workflow] = {}
        self._lock = asyncio.Lock()

    async def add(self, workflow: Workflow) -> None:
        async with self._lock:
            if workflow.id in self._items:
                raise ValueError("Workflow already exists")
            self._items[workflow.id] = deepcopy(workflow)

    async def get(self, workflow_id: UUID) -> Workflow | None:
        async with self._lock:
            item = self._items.get(workflow_id)
            return deepcopy(item) if item else None

    async def save(self, workflow: Workflow) -> None:
        async with self._lock:
            self._items[workflow.id] = deepcopy(workflow)
