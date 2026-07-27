from avito_ai.domain.models import CatalogItem, ListingDraft


class TemplateCopyAgent:
    """Safe fallback; a structured-output OpenAI adapter can replace this port."""

    async def create(self, item: CatalogItem, market: str) -> ListingDraft:
        title = f"{item.name} — пресс-вол на заказ"[:50]
        facts = item.description.strip() or "Характеристики и комплектация уточняются у продавца."
        description = (
            f"{item.name}. {facts}\n\n"
            "Подготовим расчет под вашу задачу. Цена в объявлении не является публичной офертой."
        )
        return ListingDraft(
            catalog_item_name=item.name,
            title=title,
            description=description,
            market=market,
        )
