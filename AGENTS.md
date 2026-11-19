# ENCHANTE ONE — Agent operating contract

## Mission
Build ENCHANTE ONE, a trustworthy company operating layer. Founder issues intent; system produces verified, reviewable software changes. Prioritize working product and real evidence over mock dashboards.

## Current reality
Existing Next.js application is a Genesis MVP. Its homepage currently generates a simulated company profile via setTimeout and hard-coded insights. These MUST NOT be represented as real analysis.

## Product principles
1. Connect → Understand → Recommend → Approve → Execute → Measure.
2. ONE is the customer product; ENCHANTE is the company. ENCH CONTROL is internal tooling, not the customer UI.
3. One primary action per screen. Calm, precise design; no fake metrics or unsupported claims.
4. Show source, timestamp, confidence and limitations for every recommendation.
5. Do not make external mutations without explicit authorization and an audit trail.
6. Keep customer data isolated; never expose credentials or commit secrets.
7. Prefer the smallest reversible implementation with working tests.

## Agent workflow
For every founder request:
- Inspect repository and existing behavior before editing.
- Write a short acceptance checklist and risk assessment.
- Implement on a feature branch, not directly on main.
- Run lint, typecheck, build and relevant tests; report commands and results.
- Validate user journey in a browser when available.
- Request independent review for consequential changes.
- Present working preview, changed files, known limitations and approval decision.
- Never claim deployment, successful testing, real data access or business impact without evidence.

## First priority
Replace simulated homepage insights with an honest, useful end-to-end onboarding slice. Stage 1 may analyze a user-provided domain using verifiable public evidence, or present a clearly labeled demo when no retrieval is available. The user must understand what has and has not been analyzed. Capture interest without pretending to have executed a company audit.

## Architecture constraints
Keep Next.js/TypeScript initially. Avoid introducing databases, message queues, orchestration frameworks or paid APIs without a concrete need. Integrate external models through adapters only when credentials and access are explicitly available. Treat model subscriptions and API access as distinct.

## Definition of done
A real, reproducible user journey; no fabricated insights; lint/typecheck/build passing; automated tests for critical logic; accessible loading/error/empty states; secure handling of inputs; screenshot review; documented limitations.
