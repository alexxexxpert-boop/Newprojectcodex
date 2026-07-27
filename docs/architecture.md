# Architecture and delivery plan

## Product workflow

1. **Ingest** validates a public HTTPS URL, blocks private-network SSRF targets,
   fetches bounded content and extracts product candidates.
2. **Catalog** normalizes products, prices, dimensions and source evidence.
3. **Research** imports permitted competitor/API data and produces positioning;
   it never bypasses access controls or marketplace terms.
4. **Creative** produces factual listing drafts and image transformation jobs.
5. **Compliance** checks claims, required fields, duplicates and image policy.
6. **Approval** freezes an immutable draft revision for an operator.
7. **Publish** uses an official Avito integration with an idempotency key.
8. **Optimize** consumes listing analytics and proposes, rather than silently
   applies, experiments.

The current release delivers the ingest-to-draft vertical slice. Later stages are
represented by typed states rather than misleading mock publication behavior.

## Clean architecture

- `domain`: entities, value objects, transitions and invariants; no framework I/O.
- `application`: use cases, ports and the deterministic orchestration policy.
- `agents`: independently testable catalog and copy-generation capabilities.
- `infrastructure`: HTTP/OpenAI/PostgreSQL/Redis/Avito adapters.
- `api`: transport schemas and HTTP concerns only.

An agent returns structured artifacts; it cannot publish, mutate workflow state or
read credentials. Side effects live behind ports. The orchestrator assigns a
correlation ID and persists every transition. At-least-once jobs therefore require
idempotent handlers and unique `(workflow_id, stage, revision)` keys.

## Runtime topology

FastAPI is the control plane, PostgreSQL is the source of truth, Redis provides
short-lived locks and queued work, and stateless workers execute stages. Object
storage holds original and derived images. OpenTelemetry traces carry workflow and
job IDs; metrics cover stage duration, retry count, token cost, approval conversion
and publication error rate. Dead-letter jobs retain sanitized inputs and errors.

For the initial slice an in-process repository is wired deliberately so the API is
runnable before migrations exist. The PostgreSQL repository and queue should be
the first production milestone; the ports already prevent domain changes.

## Reliability and security decisions

- URL validation resolves DNS and rejects loopback/private/link-local targets.
- Fetches are bounded by timeout and response size; redirects are revalidated in
  the production crawler.
- Prompts receive only normalized facts; generated claims are drafts requiring
  approval. Prompt/output versions are retained for reproducibility.
- Secrets come from a secret manager/environment and logs must redact user data.
- Publishing requires RBAC, explicit approval, an official API credential and an
  idempotency key. A browser is suitable for ingesting the seller's own dynamic
  site, not for automating marketplace publication.
- Backups, PITR, retention/deletion policies, rate limits and per-tenant quotas are
  release gates.

## Delivery phases

1. Foundation and ingest-to-draft slice (this change).
2. PostgreSQL migrations, transactional outbox, Redis workers and object storage.
3. Playwright crawler sandbox plus image pipeline and moderation.
4. Approved competitor feeds and official Avito adapter in a staging account.
5. Analytics event model, guarded A/B experiments, dashboards and SLO alerts.
