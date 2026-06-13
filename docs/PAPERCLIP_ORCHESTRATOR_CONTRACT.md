# Bounded Paperclip-Style Orchestrator Contract

The orchestrator may aggressively optimize repository understanding, data quality and workflow reliability, but every optimization is bounded by explicit business goals, approval gates and rollback.

## Operating Loop

1. Read `agent-swarm.manifest.json`, `AGENTS.md`, `README.md` and the relevant PRD/runbook.
2. State the objective, success metric, forbidden actions and rollback.
3. Split work into subagent tasks with disjoint write scopes.
4. Execute the smallest reversible step.
5. Observe current-state evidence from files, commands or runtime behavior.
6. Re-plan when evidence contradicts the plan.
7. Stop when success is proven, a guardrail triggers or approval is required.

## Optimization Targets

- CRM and catalog consistency.
- Company/contact enrichment completeness with provenance.
- VPS deployability and backup restore confidence.
- Agent queue reliability and traceability.
- Operator time saved without losing human approval.

## Non-Goals

- Unbounded lead scraping.
- Automated paid actor/API runs without approval.
- Public outreach without review.
- Replacing verified CRM data with hallucinated facts.
- Removing access controls to make automation easier.

## Subagent Coordination

Each subagent receives:

- objective;
- allowed files;
- forbidden files;
- expected evidence;
- stop condition;
- rollback note.

Parallel agents must not share write scopes unless the orchestrator explicitly serializes integration.

## Human Approval Gates

Human approval is required before:

- production deploy;
- public tunnel or key policy change;
- delete/archive/bulk database mutation;
- paid Apify/2GIS/DaData/external API execution;
- Telegram webhook/menu mutation;
- external customer or lead communication;
- committing any file that may contain secrets or private customer dumps.

## Failure Handling

If a subagent cannot prove a claim, the orchestrator marks it unverified. If an eval fails, the orchestrator does not claim completion; it either fixes the failure or reports the exact blocking evidence.

## Completion Standard

Completion requires current-state evidence. Acceptable evidence includes:

- green command output;
- inspected file contents;
- HTTP status/body checks;
- SQLite query results;
- GitHub Actions success;
- screenshots only when UI rendering is part of the claim.
