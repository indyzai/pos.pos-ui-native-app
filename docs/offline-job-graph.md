# Offline dependency graphs and failure correction

The React web, POS Native and Admin Native clients share `packages/sync`'s durable dependency executor. Network execution defaults to four concurrent requests per authenticated database scope. Dependencies and resource locks constrain that limit. SQLite/IndexedDB transactions remain short; no network request runs inside a database transaction.

## Write and replay contract

- A locally accepted write must persist its projection and command in one transaction.
- `enqueueCommand` extends existing single-command flows. `enqueueWorkflow` atomically accepts an unordered set of named commands and an optional projection callback, validates and saves prerequisites first, and rolls everything back if any command or projection fails.
- Persist dependency job IDs and typed reference paths. The explicit relationship vocabulary lives in `references.ts`; platform adapters retain compatibility inference for existing commands. New relationships must extend that vocabulary and have adapter tests.
- A job is ready only when all prerequisites are synced and its retry time is due. Claims recheck dependencies, scope concurrency and resource availability transactionally, including across multiple runtimes/tabs.
- Entity and reference resource keys serialize overlapping work. Resource identities resolve through retained receipts so assigning a server ID cannot split one resource into two locks.
- Each claim has a distinct fencing token, an ownership lease and a resolved dispatch snapshot. Heartbeats cover credential acquisition and network execution. Stale claims cannot acknowledge or release a reclaimed lease.
- Each committed acknowledgement saves its receipt and ID mappings together with projection changes. A newly ready dependent can start immediately, without waiting for unrelated requests.
- Receipts are the durable, scope-qualified mapping authority. Web additionally writes table-qualified `syncIdMapping:<table>:<localId>` metadata. Completed receipts are archived for display, not physically deleted. Historical unqualified metadata is retained but is not blindly applied across entity tables.

## Failure behavior

Transient errors use exponential backoff with jitter and retain the existing three-attempt default. Confirmed offline deferrals do not spend attempts. Rate limiting respects a supplied `retryAfterMs` and does not spend business attempts. Authentication failure pauses new dispatch; renewal or explicit retry resumes retained authentication failures. Other independent branches continue after ordinary job failures.

The public job view includes `blockedBy` and `blockedReason`; missing prerequisites, cycles and missing ID receipts remain visible. A missing mapping is not dispatched and cannot create a hot polling loop. Malformed reference paths fail the affected job without aborting independent work.

## Corrections in feature screens

Web feature pages show matching failed changes and an Edit and retry form. The Sync Jobs page links back to those pages and displays the dependency tree. Native feature headers show matching failures; Settings exposes the full dependency tree, unchanged retries and correction forms. Fields are generated from the retained business input, including nested scalar fields. Identities, relationship IDs, credentials and transport mutation keys are protected.

Correction creates a replacement command with a new job/key while retaining and archiving the rejected original. Descendants are redirected atomically to the replacement; its successful acknowledgement unlocks them. Transport mutation keys rotate, while financial event identities remain stable. Native compatibility aliases identify the replacement. Edited projections commit in the same transaction and preserve newer local edits. Sale stock/counter and native cash projections receive corresponding deltas; native sale batch deductions remain constrained by selected batch stock.

A command sent to the server can be edited only after a definitive validation rejection. Lost responses and uncertain/conflicting server outcomes require reconciliation before changing input. Retrying unchanged input preserves its original key. The backend contract in `pos.pos-api-svc/docs/offline-mutation-idempotency.md` remains authoritative: some resolver failures are intentionally uncertain and cannot be converted into safe automatic retries by a client change.

## Compatibility and rollout

New metadata is optional inside existing JSON job payloads. Existing physical schemas and version-1 receipts are retained, so these changes need no SQL or IndexedDB schema version change. The shared sync source is synchronized between the two vendored checkouts; unrelated differences between their vendor revisions are preserved.

`SyncEngineOptions.concurrency`, `NativeSyncOptions.concurrency`, `NativeSyncWorkerProps.concurrency` and web `initJobQueue({ concurrency })` accept 1 through 16. Start a staged deployment at 1, then 2, then 4. Observe failed/blocked jobs, duplicate server effects, unresolved mappings, request latency and restart recovery before increasing capacity.

Release validation still requires real Android/iOS SQLite and a deployed POS API: offline checkout with quick-add product/customer/counter prerequisites, process termination, reconnect interruption, field correction, multi-tab claims, actual batch stock and final counter totals. Automated adapter tests do not establish those deployed outcomes.
