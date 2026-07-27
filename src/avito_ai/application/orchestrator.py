import asyncio
import logging
from uuid import UUID

from avito_ai.application.ports import CatalogAgent, CopyAgent, WorkflowRepository
from avito_ai.domain.models import Workflow

logger = logging.getLogger(__name__)


class WorkflowOrchestrator:
    """Owns transitions; agents remain stateless and side-effect constrained."""

    def __init__(
        self,
        repository: WorkflowRepository,
        catalog_agent: CatalogAgent,
        copy_agent: CopyAgent,
    ) -> None:
        self._repository = repository
        self._catalog_agent = catalog_agent
        self._copy_agent = copy_agent

    async def start(self, website_url: str, market: str) -> Workflow:
        workflow = Workflow(website_url=website_url, market=market)
        await self._repository.add(workflow)
        try:
            items = list(await self._catalog_agent.discover(website_url))
            if not items:
                raise ValueError("No catalog items were found")
            workflow.catalog_ready(items)
            await self._repository.save(workflow)
            drafts = await asyncio.gather(
                *(self._copy_agent.create(item, market) for item in items)
            )
            workflow.drafts_ready(list(drafts))
        except Exception as exc:
            logger.exception("Workflow %s failed", workflow.id)
            workflow.fail(str(exc))
        await self._repository.save(workflow)
        return workflow

    async def get(self, workflow_id: UUID) -> Workflow | None:
        return await self._repository.get(workflow_id)
