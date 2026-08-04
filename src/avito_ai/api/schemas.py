from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from avito_ai.domain.models import WorkflowStatus


class StartWorkflowRequest(BaseModel):
    website_url: HttpUrl
    market: str = Field(min_length=2, max_length=100)


class CatalogItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    source_url: str
    description: str
    price_rub: int | None
    image_urls: tuple[str, ...]
    category: str


class DraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    catalog_item_name: str
    title: str
    description: str
    market: str
    keywords: tuple[str, ...]
    image_urls: tuple[str, ...]
    source_url: str
    alternate_titles: tuple[str, ...]


class WorkflowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    website_url: str
    market: str
    status: WorkflowStatus
    catalog: list[CatalogItemResponse]
    drafts: list[DraftResponse]
    error: str | None
    created_at: datetime
