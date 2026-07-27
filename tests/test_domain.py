import pytest

from avito_ai.domain.models import CatalogItem, Workflow, WorkflowStatus


def test_workflow_rejects_out_of_order_transition() -> None:
    workflow = Workflow("https://example.com", "Москва")
    with pytest.raises(ValueError, match="Cannot attach drafts"):
        workflow.drafts_ready([])
    assert workflow.status is WorkflowStatus.RECEIVED


def test_catalog_item_rejects_negative_price() -> None:
    with pytest.raises(ValueError, match="Price cannot be negative"):
        CatalogItem("Press wall", "https://example.com", price_rub=-1)
