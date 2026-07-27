from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4


class WorkflowStatus(StrEnum):
    RECEIVED = "received"
    CATALOG_READY = "catalog_ready"
    DRAFTS_READY = "drafts_ready"
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class CatalogItem:
    name: str
    source_url: str
    description: str = ""
    price_rub: int | None = None

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("Catalog item name cannot be blank")
        if self.price_rub is not None and self.price_rub < 0:
            raise ValueError("Price cannot be negative")


@dataclass(frozen=True, slots=True)
class ListingDraft:
    catalog_item_name: str
    title: str
    description: str
    market: str


@dataclass(slots=True)
class Workflow:
    website_url: str
    market: str
    id: UUID = field(default_factory=uuid4)
    status: WorkflowStatus = WorkflowStatus.RECEIVED
    catalog: list[CatalogItem] = field(default_factory=list)
    drafts: list[ListingDraft] = field(default_factory=list)
    error: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def catalog_ready(self, items: list[CatalogItem]) -> None:
        if self.status is not WorkflowStatus.RECEIVED:
            raise ValueError(f"Cannot attach catalog in {self.status}")
        self.catalog = items
        self.status = WorkflowStatus.CATALOG_READY

    def drafts_ready(self, drafts: list[ListingDraft]) -> None:
        if self.status is not WorkflowStatus.CATALOG_READY:
            raise ValueError(f"Cannot attach drafts in {self.status}")
        self.drafts = drafts
        self.status = WorkflowStatus.DRAFTS_READY

    def fail(self, message: str) -> None:
        self.error = message[:500]
        self.status = WorkflowStatus.FAILED
