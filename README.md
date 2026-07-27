# Avito Presswall AI

Production-oriented foundation for an AI agent that turns a press-wall vendor's
website into a reviewed Avito publication plan. The service is intentionally
**human-in-the-loop**: it prepares drafts and assets, but an operator must approve
them before an official marketplace adapter may publish anything.

## Why this architecture

The system is split into domain, application, agent and infrastructure layers.
Agents do one job and exchange typed artifacts; the orchestrator owns state and
policy instead of letting an LLM control side effects. This makes retries,
auditing, model replacement and horizontal worker scaling predictable.

The first vertical slice implements catalog discovery and listing generation.
Competitor research, image preparation, publication and optimization are explicit
workflow stages and ports, so they can be connected without changing the core.
Competitor data must come from permitted APIs or operator-provided exports—not
fragile or prohibited marketplace scraping. Publication is only through an
official integration, after approval.

See [the architecture decision record](docs/architecture.md) for boundaries,
workflow, scaling plan and production risks.

## Run locally

```bash
cp .env.example .env
docker compose up --build
curl http://localhost:8000/health
```

API docs are available at `http://localhost:8000/docs`. Start a workflow with:

```bash
curl -X POST http://localhost:8000/v1/workflows \
  -H 'Content-Type: application/json' \
  -d '{"website_url":"https://example.com","market":"Москва"}'
```

For development without Docker:

```bash
python -m venv .venv && . .venv/bin/activate
pip install -e '.[dev]'
uvicorn avito_ai.main:app --reload
pytest
```

## Configuration

Configuration is environment-only (12-factor). `OPENAI_API_KEY` is optional: in
its absence the deterministic generator keeps local development and tests usable.
Never commit marketplace or OpenAI credentials.
