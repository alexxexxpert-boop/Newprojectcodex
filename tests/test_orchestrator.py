from avito_ai.agents.copywriter import TemplateCopyAgent
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


async def test_copywriter_embeds_keywords_and_keeps_source_photos() -> None:
    item = CatalogItem(
        name="Пресс-волл 3х2",
        source_url="https://example.com/press-wall-3x2/",
        description="Изготавливаем металлическую конструкцию с печатью баннера.",
        price_rub=15000,
        image_urls=("https://example.com/photo.jpg",),
    )

    draft = await TemplateCopyAgent().create(item, "Москва")

    assert "пресс-волл" in draft.keywords
    assert draft.keywords[0] in draft.description.lower()
    assert draft.image_urls == item.image_urls
    assert draft.source_url == item.source_url
    assert len(draft.title) <= 50
