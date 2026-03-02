# Agent Prompt Scripts

Use these scripts to print the Sprint 1 startup prompt per agent.

## Usage

```bash
cd /opt/docker/apps/cacheflow
bash scripts/agent-prompts/sprint1_claude.sh
bash scripts/agent-prompts/sprint1_opencode.sh
bash scripts/agent-prompts/sprint1_gemini.sh
bash scripts/agent-prompts/sprint1_codex.sh
```

Each script prints a single-agent prompt with:
- startup checks
- assigned task keys
- lock/metrics workflow
- session close steps
