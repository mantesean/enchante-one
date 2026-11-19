# ENCH CONTROL — Genesis

Minimal auditable intent-to-review kernel. **Not an autonomous AI orchestrator yet.** Persists intents, enforces stage transitions, requires evidence and founder approval.

Requires Node 20+. From `control/`:

```bash
npm test
npm run run -- intent "Build evidence-backed ENCHANTE ONE onboarding"
npm run run -- status <id>
```

Tasks persist locally in `.ench/tasks/`. The `advance` command is a developer primitive, not proof of automated work. The local `ENCH_ACTOR=founder` flag is **not authentication**; never use it for production approval.

Next: authenticated control surface, real isolated Codex adapter, GitHub PR + CI integration, browser QA and audit logs. Never claim autonomous execution before an end-to-end run.
