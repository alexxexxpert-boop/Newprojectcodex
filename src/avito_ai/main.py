from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request, status

from avito_ai.agents.catalog import HttpCatalogAgent
from avito_ai.agents.copywriter import TemplateCopyAgent
from avito_ai.api.schemas import StartWorkflowRequest, WorkflowResponse
from avito_ai.application.orchestrator import WorkflowOrchestrator
from avito_ai.config import get_settings
from avito_ai.infrastructure.repository import InMemoryWorkflowRepository


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    app.state.orchestrator = WorkflowOrchestrator(
        InMemoryWorkflowRepository(),
        HttpCatalogAgent(settings.crawl_timeout_seconds, settings.max_catalog_items),
        TemplateCopyAgent(),
    )
    yield


app = FastAPI(title="Avito Presswall AI", version="0.1.0", lifespan=lifespan)


def get_orchestrator(request: Request) -> WorkflowOrchestrator:
    return request.app.state.orchestrator  # type: ignore[no-any-return]


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/workflows", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def start_workflow(
    payload: StartWorkflowRequest,
    orchestrator: Annotated[WorkflowOrchestrator, Depends(get_orchestrator)],
) -> WorkflowResponse:
    workflow = await orchestrator.start(str(payload.website_url), payload.market)
    return WorkflowResponse.model_validate(workflow)


@app.get("/v1/workflows/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: UUID,
    orchestrator: Annotated[WorkflowOrchestrator, Depends(get_orchestrator)],
) -> WorkflowResponse:
    workflow = await orchestrator.get(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return WorkflowResponse.model_validate(workflow)
