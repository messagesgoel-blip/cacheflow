# Agent Prompt Scripts

Use these scripts to print the active Sprint 6 startup prompts per agent.

## Usage

```bash
cd /home/sanjay/cacheflow_work
bash scripts/agent-prompts/sprint6_claude.sh
bash scripts/agent-prompts/sprint6_opencode.sh
bash scripts/agent-prompts/sprint6_gemini.sh
bash scripts/agent-prompts/sprint6_codex.sh
```

Active references:
- `docs/roadmap.md`
- `docs/sprints/sprint-6.md`
- `docs/prompts/sprint-6-startup-all-agents.md`

Each script uses a compact startup flow:
- `agent-preflight` + task claim first
- `STATUS.md` and recent git log are mandatory
- `.context/*` files are loaded lazily when relevant to touched scope
- lock + session-close workflow remains explicit
- worker agents finish with `done-task <task_key> --test ... --commit ...`
- `done-task --test ... --commit ...` auto-detects task key when one lock is active
- Codex owns shared dashboard/metrics/status sync after lock release

