import re

from avito_ai.domain.models import CatalogItem, ListingDraft

_SPACE_RE = re.compile(r"\s+")


def _clean(value: str) -> str:
    return _SPACE_RE.sub(" ", value).strip(" .,—")


def _dedupe(values: list[str]) -> tuple[str, ...]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        cleaned = _clean(value).lower()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
    return tuple(result)


def _keywords(item: CatalogItem, market: str) -> tuple[str, ...]:
    source = f"{item.name} {item.description}".lower()
    name = _clean(item.name).lower()
    values = [name]
    is_presswall = any(
        word in source for word in ("пресс волл", "пресс-волл", "press wall", "presswall")
    )
    if is_presswall:
        values.extend(
            [
                "пресс-волл",
                "press wall",
                "бренд-волл",
                "фотозона",
                "пресс-волл на заказ",
            ]
        )
    if "аренд" in source:
        values.extend(["аренда пресс-волла", "пресс-волл в аренду"])
    elif is_presswall:
        values.extend(["купить пресс-волл", "изготовление пресс-волла"])
    else:
        values.extend([f"купить {name}", f"{name} на заказ"])
    if "баннер" in source or "печать" in source:
        values.extend(["печать баннера", "баннер для пресс-волла"])
    if "монтаж" in source:
        values.append("монтаж пресс-волла")
    values.append(f"{name} {market}")
    if is_presswall:
        values.append(f"пресс-волл {market}")
    return _dedupe(values)[:12]


def _fit_title(value: str, limit: int = 50) -> str:
    value = _clean(value)
    if len(value) <= limit:
        return value
    shortened = value[: limit + 1].rsplit(" ", 1)[0].rstrip(" ,—-")
    return shortened or value[:limit]


def _location_phrase(market: str) -> str:
    normalized = market.strip().casefold()
    known = {
        "москва": "Москве",
        "санкт-петербург": "Санкт-Петербурге",
        "спб": "Санкт-Петербурге",
    }
    return known.get(normalized, f"городе {market.strip()}")


def _titles(item: CatalogItem, market: str, keywords: tuple[str, ...]) -> tuple[str, ...]:
    name = _clean(item.name)
    source = f"{name} {item.source_url}".lower()
    if "аренд" in source:
        primary = f"Аренда {name}"
    elif item.category == "Услуги для бизнеса" or any(
        word in source for word in ("изготов", "печать", "на заказ")
    ):
        primary = f"{name} на заказ"
    else:
        primary = f"Купить {name.lower()}"
    values = [
        _fit_title(primary),
        _fit_title(f"{name} — {market}"),
        _fit_title(f"{name} с доставкой"),
    ]
    if keywords:
        values.append(_fit_title(f"{keywords[0].capitalize()} {market}"))
    return tuple(dict.fromkeys(value for value in values if value))


def _source_fact(item: CatalogItem) -> str:
    description = _clean(item.description)
    if not description:
        return "Характеристики и комплектацию уточним перед оформлением заказа."
    sentences = re.split(r"(?<=[.!?])\s+", description)
    selected: list[str] = []
    length = 0
    for sentence in sentences:
        sentence = _clean(sentence).rstrip(".!?")
        if len(sentence) < 25:
            continue
        selected.append(sentence)
        length += len(sentence)
        if length >= 430 or len(selected) == 3:
            break
    return ". ".join(selected).rstrip(".") + "."


class TemplateCopyAgent:
    """Creates a factual Avito-ready draft and naturally embeds search phrases."""

    async def create(self, item: CatalogItem, market: str) -> ListingDraft:
        keywords = _keywords(item, market)
        titles = _titles(item, market, keywords)
        price_line = (
            f"Цена — от {item.price_rub:,} ₽.".replace(",", " ")
            if item.price_rub is not None
            else "Стоимость рассчитаем по размеру, комплектации и сроку."
        )
        main_keyword = keywords[0] if keywords else item.name.lower()
        related = ", ".join(keywords[1:4]) if len(keywords) > 1 else main_keyword
        description = (
            f"{item.name} в {_location_phrase(market)}. Подготовим предложение под вашу задачу.\n\n"
            f"{_source_fact(item)}\n\n"
            "Что можно уточнить перед заказом:\n"
            "— нужный размер и комплектацию;\n"
            "— требования к макету и печати;\n"
            "— срок готовности, доставку и монтаж.\n\n"
            f"{price_line}\n\n"
            f"Если вы ищете {main_keyword}, также поможем подобрать решение по запросам: "
            f"{related}. Напишите в чат — уточним задачу и подготовим расчёт."
        )
        return ListingDraft(
            catalog_item_name=item.name,
            title=titles[0],
            description=description,
            market=market,
            keywords=keywords,
            image_urls=item.image_urls,
            source_url=item.source_url,
            alternate_titles=titles[1:],
        )
