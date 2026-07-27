import ipaddress
import re
import socket
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx

from avito_ai.domain.models import CatalogItem


class _TitleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_title = False
        self.title: list[str] = []
        self.headings: list[str] = []
        self._heading: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self.in_title = True
        elif tag in {"h1", "h2"}:
            self._heading = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False
        elif tag in {"h1", "h2"} and self._heading is not None:
            value = " ".join(self._heading).strip()
            if value:
                self.headings.append(value)
            self._heading = None

    def handle_data(self, data: str) -> None:
        value = re.sub(r"\s+", " ", data).strip()
        if not value:
            return
        if self.in_title:
            self.title.append(value)
        if self._heading is not None:
            self._heading.append(value)


def validate_public_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError("website_url must be a public HTTPS URL")
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(parsed.hostname, 443)}
    except socket.gaierror as exc:
        raise ValueError("website_url hostname cannot be resolved") from exc
    if any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise ValueError("website_url resolves to a non-public address")


class HttpCatalogAgent:
    def __init__(self, timeout: float = 20, max_items: int = 50) -> None:
        self._timeout = timeout
        self._max_items = max_items

    async def discover(self, website_url: str) -> list[CatalogItem]:
        validate_public_url(website_url)
        async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=False) as client:
            response = await client.get(website_url, headers={"User-Agent": "PresswallCatalog/1.0"})
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if "text/html" not in content_type:
                raise ValueError("website_url must return HTML")
            if len(response.content) > 2_000_000:
                raise ValueError("Website response exceeds 2 MB")
        parser = _TitleParser()
        parser.feed(response.text)
        candidates = parser.headings or parser.title
        unique = list(dict.fromkeys(candidates))[: self._max_items]
        return [CatalogItem(name=name[:160], source_url=website_url) for name in unique]
