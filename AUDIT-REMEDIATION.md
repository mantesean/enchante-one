# Retrieval audit remediation

Acceptance: bounded DNS/headers/body and retry budget; no HTTPS downgrade; truthful static observations; default-off external retrieval; bounded user request; no caller-controlled rate-limit identity; working empty/error/retry/observation browser flows. No payment promise, no credentials, no deployment.

`ENCH_PUBLIC_RETRIEVAL_ENABLED` defaults to off. The route returns explicit unavailability before fetching any website. Enable only in an explicitly authorized retrieval environment. The rate cap is deliberately shared per process, not a global distributed limit or identity/tenant boundary. Public retrieval is not the autonomous runtime.

Reproduce with Node 22+: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:browser`. Browser tests use disabled retrieval plus explicitly synthetic intercepted observations; no public website traffic. Build no longer fetches Google Fonts. CI runs these checks and uploads evidence.

PR3's local state engine is separately retired; it is not part of this application. Prefer the honest PR5 foundation and the independently developed read-only COMMAND adapter for the founder path; these corrections make PR1 reviewable, not approved for merge or production. No new orchestrator is introduced.

Remaining limits: static HTML is not rendered content or business intelligence; per-process cap is not production ingress control; successful build/tests do not authorize merge/deploy. Regression tests cover audit counterexamples, abort races and late-response disposal. GitHub protections and external runtime isolation are separate gates.
