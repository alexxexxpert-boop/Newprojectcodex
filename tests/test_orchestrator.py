from avito_ai.application.orchestrator import WorkflowOrchestrator
from avito_ai.domain.models import CatalogItem, ListingDraft, WorkflowStatus
from avito_ai.infrastructure.repository import InMemoryWorkflowRepository


class CatalogStub:
    async def discover(self, website_url: str) -> list[CatalogItem]:
        return [CatalogItem(name="Press wall 3x2", source_url=website_url, price_rub=15000)]


class CopyStub:
    async def create(self, item: CatalogItem, market: str) -> ListingDraft:
        return ListingDraft(item.name, "Press wall 3x2", "Описание", market)


async def test_orchestrator_builds_catalog_and_drafts() -> None:
    repository = InMemoryWorkflowRepository()
    orchestrator = WorkflowOrchestrator(repository, CatalogStub(), CopyStub())

    workflow = await orchestrator.start("https://example.com", "Москва")

    assert workflow.status is WorkflowStatus.DRAFTS_READY
    assert workflow.catalog[0].price_rub == 15000
    assert workflow.drafts[0].market == "Москва"
    assert await repository.get(workflow.id) == workflow


class EmptyCatalogStub:
    async def discover(self, website_url: str) -> list[CatalogItem]:
        return []


async def test_orchestrator_records_failure() -> None:
    orchestrator = WorkflowOrchestrator(
        InMemoryWorkflowRepository(), EmptyCatalogStub(), CopyStub()
    )
    workflow = await orchestrator.start("https://example.com", "Москва")
    assert workflow.status is WorkflowStatus.FAILED
    assert workflow.error == "No catalog items were found"
