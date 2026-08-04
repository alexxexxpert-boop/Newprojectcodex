import asyncio
import ipaddress
import json
import re
import socket
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse, urlunparse
from xml.etree import ElementTree

import httpx

from avito_ai.domain.models import CatalogItem

_SPACE_RE = re.compile(r"\s+")
_PRICE_RE = re.compile(
    r"(?:от\s*)?(\d[\d\s\u00a0]{2,10})\s*(?:₽|руб(?:\.|лей|ля)?)",
    re.IGNORECASE,
)
_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".avif")
_SKIP_PATH_PARTS = (
    "/tag/",
    "/author/",
    "/category/",
    "/cart",
    "/checkout",
    "/my-account",
    "/privacy",
    "/politika",
    "/kontakty",
    "/contact",
)
_PRODUCT_PATH_HINTS = (
    "/internet-magazin/",
    "/product/",
    "/uslugi/",
    "/izgotovlen",
    "/arenda",
    "/press-wall",
    "/press-voll",
    "/fotoconstruction",
    "/fotokonstruk",
    "/stend",
    "/banner",
)


def _clean(value: str) -> str:
    return _SPACE_RE.sub(" ", value).strip()


def _clean_url(url: str) -> str:
    parsed = urlparse(url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))


def validate_public_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError("Адрес сайта должен быть публичным HTTPS-адресом")
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(parsed.hostname, 443)}
    except socket.gaierror as exc:
        raise ValueError("Не удалось найти сайт по указанному адресу") from exc
    if any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise ValueError("Адрес сайта ведёт во внутреннюю сеть")


class _PageParser(HTMLParser):
    def __init__(self, page_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.page_url = page_url
        self.title_parts: list[str] = []
        self.h1_parts: list[str] = []
        self.paragraphs: list[str] = []
        self.images: list[str] = []
        self.meta: dict[str, str] = {}
        self.json_ld: list[str] = []
        self._capture: str | None = None
        self._buffer: list[str] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {name.lower(): value or "" for name, value in attrs}
        if tag in {"script", "style", "noscript", "svg"}:
            if tag == "script" and values.get("type", "").lower() == "application/ld+json":
                self._capture = "json_ld"
                self._buffer = []
                return
            self._ignored_depth += 1
            return
        if self._ignored_depth:
            return
        if tag in {"title", "h1", "p"}:
            self._capture = tag
            self._buffer = []
        elif tag == "meta":
            key = (values.get("property") or values.get("name") or "").lower()
            content = _clean(values.get("content", ""))
            if key and content:
                self.meta[key] = content
        elif tag == "img":
            raw = (
                values.get("data-src")
                or values.get("data-lazy-src")
                or values.get("data-lzl-src")
                or values.get("src")
                or values.get("data-original")
            )
            if raw:
                self.images.append(urljoin(self.page_url, raw))

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            if self._capture == "json_ld" and tag == "script":
                value = "".join(self._buffer).strip()
                if value:
                    self.json_ld.append(value)
                self._capture = None
                self._buffer = []
                return
            self._ignored_depth = max(0, self._ignored_depth - 1)
            return
        if self._ignored_depth or self._capture != tag:
            return
        value = _clean(" ".join(self._buffer))
        if value:
            if tag == "title":
                self.title_parts.append(value)
            elif tag == "h1":
                self.h1_parts.append(value)
            elif tag == "p" and len(value) >= 45:
                self.paragraphs.append(value)
        self._capture = None
        self._buffer = []

    def handle_data(self, data: str) -> None:
        if self._capture is not None:
            self._buffer.append(data)


def _walk_json(value: object) -> list[dict[str, object]]:
    found: list[dict[str, object]] = []
    if isinstance(value, dict):
        found.append(value)
        for child in value.values():
            found.extend(_walk_json(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(_walk_json(child))
    return found


def _schema_product(parser: _PageParser) -> dict[str, object]:
    for raw in parser.json_ld:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue
        for node in _walk_json(payload):
            node_type = node.get("@type")
            types = node_type if isinstance(node_type, list) else [node_type]
            if any(item in {"Product", "Service", "Offer"} for item in types):
                return node
    return {}


def _schema_images(node: dict[str, object], page_url: str) -> list[str]:
    raw = node.get("image")
    values = raw if isinstance(raw, list) else [raw]
    images: list[str] = []
    for value in values:
        if isinstance(value, str):
            images.append(urljoin(page_url, value))
        elif isinstance(value, dict):
            candidate = value.get("url") or value.get("contentUrl")
            if isinstance(candidate, str):
                images.append(urljoin(page_url, candidate))
    return images


def _extract_price(parser: _PageParser, schema: dict[str, object]) -> int | None:
    candidates: list[object] = []
    offers = schema.get("offers")
    if isinstance(offers, dict):
        candidates.extend([offers.get("price"), offers.get("lowPrice")])
    for node in _walk_json(schema):
        candidates.extend([node.get("price"), node.get("lowPrice")])
    candidates.extend([schema.get("price"), parser.meta.get("product:price:amount")])
    for value in candidates:
        if value is None:
            continue
        normalized = re.sub(r"[^\d]", "", str(value))
        if normalized:
            price = int(normalized)
            if 0 < price < 1_000_000_000:
                return price
    searchable = " ".join(
        [
            parser.meta.get("description", ""),
            parser.meta.get("og:description", ""),
            *parser.paragraphs[:8],
        ]
    )
    match = _PRICE_RE.search(searchable)
    if match:
        return int(re.sub(r"\D", "", match.group(1)))
    return None


def _looks_like_photo(url: str) -> bool:
    lowered = url.lower().split("?", 1)[0]
    if not lowered.endswith(_IMAGE_EXTENSIONS):
        return False
    if any(
        marker in lowered
        for marker in (
            "logo",
            "icon",
            "sprite",
            "avatar",
            "payment",
            "favicon",
            "placeholder",
            "telegram",
            "whatsapp",
            "e1778536272597",
        )
    ):
        return False
    dimensions = re.search(r"-(\d{2,4})x(\d{2,4})(?:\.[a-z]+)+$", lowered)
    return not dimensions or min(int(dimensions.group(1)), int(dimensions.group(2))) >= 250


def _category_for(name: str, url: str) -> str:
    source = f"{name} {url}".lower()
    if "аренд" in source or "prokat" in source:
        return "Аренда оборудования"
    if any(word in source for word in ("изготов", "печать", "монтаж", "дизайн")):
        return "Услуги для бизнеса"
    return "Оборудование для бизнеса"


class HttpCatalogAgent:
    """Discovers real product/service pages through sitemap files and keeps source photos."""

    def __init__(self, timeout: float = 20, max_items: int = 50) -> None:
        self._timeout = timeout
        self._max_items = max_items

    async def discover(self, website_url: str) -> list[CatalogItem]:
        validate_public_url(website_url)
        root_url = website_url.rstrip("/") + "/"
        hostname = urlparse(root_url).hostname
        limits = httpx.Limits(max_connections=8, max_keepalive_connections=5)
        headers = {"User-Agent": "AvitoCatalogAssistant/1.0 (+catalog import)"}
        async with httpx.AsyncClient(
            timeout=self._timeout,
            follow_redirects=True,
            limits=limits,
            headers=headers,
        ) as client:
            urls = await self._discover_urls(client, root_url, hostname or "")
            semaphore = asyncio.Semaphore(6)

            async def parse(url: str) -> CatalogItem | None:
                async with semaphore:
                    return await self._parse_page(client, url)

            parsed = await asyncio.gather(*(parse(url) for url in urls), return_exceptions=True)

        items: list[CatalogItem] = []
        seen_names: set[str] = set()
        for result in parsed:
            if not isinstance(result, CatalogItem):
                continue
            key = re.sub(r"\W", "", result.name.casefold())
            if not key or key in seen_names:
                continue
            seen_names.add(key)
            items.append(result)
            if len(items) >= self._max_items:
                break
        return items

    async def _discover_urls(
        self, client: httpx.AsyncClient, root_url: str, hostname: str
    ) -> list[str]:
        queue = [urljoin(root_url, "sitemap.xml")]
        seen_sitemaps: set[str] = set()
        page_urls: list[str] = []
        while queue and len(seen_sitemaps) < 12:
            sitemap_url = queue.pop(0)
            if sitemap_url in seen_sitemaps:
                continue
            seen_sitemaps.add(sitemap_url)
            try:
                response = await client.get(sitemap_url)
                response.raise_for_status()
                if len(response.content) > 5_000_000:
                    continue
                document = ElementTree.fromstring(response.content)
            except (httpx.HTTPError, ElementTree.ParseError):
                continue
            locations = [
                _clean(element.text or "")
                for element in document.iter()
                if element.tag.endswith("loc") and element.text
            ]
            if document.tag.endswith("sitemapindex"):
                nested = [
                    location
                    for location in locations
                    if urlparse(location).hostname == hostname
                ]
                nested.sort(
                    key=lambda url: (
                        0
                        if "product-sitemap" in url
                        else 1
                        if "page-sitemap" in url
                        else 2
                    )
                )
                queue.extend(nested)
            else:
                page_urls.extend(
                    location
                    for location in locations
                    if self._is_candidate_url(location, hostname)
                )

        if not page_urls:
            return [root_url]
        unique = list(dict.fromkeys(_clean_url(url) for url in page_urls))

        def priority(url: str) -> tuple[int, int, int]:
            path = urlparse(url).path.lower()
            segments = len([part for part in path.split("/") if part])
            if "/internet-magazin/" in path and segments >= 2:
                group = 0
            elif "/uslugi/" in path and segments >= 2:
                group = 1
            elif any(hint in path for hint in _PRODUCT_PATH_HINTS):
                group = 2
            else:
                group = 3
            return group, -segments, len(path)

        unique.sort(key=priority)
        return unique[: max(self._max_items * 3, 24)]

    @staticmethod
    def _is_candidate_url(url: str, hostname: str) -> bool:
        parsed = urlparse(url)
        lowered_path = parsed.path.lower()
        if parsed.scheme != "https" or parsed.hostname != hostname:
            return False
        if lowered_path.endswith(_IMAGE_EXTENSIONS) or lowered_path.endswith(
            (".pdf", ".xml", ".zip", ".mp4")
        ):
            return False
        if lowered_path.rstrip("/") in {"/internet-magazin", "/uslugi"}:
            return False
        return not any(part in lowered_path for part in _SKIP_PATH_PARTS)

    async def _parse_page(
        self, client: httpx.AsyncClient, page_url: str
    ) -> CatalogItem | None:
        try:
            response = await client.get(page_url)
            response.raise_for_status()
        except httpx.HTTPError:
            return None
        if "text/html" not in response.headers.get("content-type", ""):
            return None
        if len(response.content) > 3_000_000:
            return None

        parser = _PageParser(page_url)
        parser.feed(response.text)
        schema = _schema_product(parser)
        raw_name = schema.get("name")
        name = (
            _clean(str(raw_name))
            if isinstance(raw_name, str)
            else next(iter(parser.h1_parts), "")
        )
        if not name:
            name = parser.meta.get("og:title") or next(iter(parser.title_parts), "")
        name = re.split(r"\s+[|—]\s+", name)[0].strip()
        if len(name) < 4:
            return None

        raw_description = schema.get("description")
        description = (
            _clean(str(raw_description))
            if isinstance(raw_description, str)
            else parser.meta.get("description")
            or parser.meta.get("og:description")
            or " ".join(parser.paragraphs[:2])
        )
        description = _clean(description)[:1200]
        if len(description) < 30 and not schema:
            return None

        schema_photos = _schema_images(schema, page_url)
        if schema_photos:
            # Product schema points at the photos that belong to this exact item.
            # Page-level <img> tags often include navigation, recommendations and icons.
            photos = schema_photos
        else:
            photos = [parser.meta.get("og:image", ""), *parser.images]
        image_urls = tuple(
            dict.fromkeys(
                _clean_url(urljoin(page_url, photo))
                for photo in photos
                if photo and _looks_like_photo(urljoin(page_url, photo))
            )
        )[:10]
        return CatalogItem(
            name=name[:160],
            source_url=page_url,
            description=description,
            price_rub=_extract_price(parser, schema),
            image_urls=image_urls,
            category=_category_for(name, page_url),
        )
