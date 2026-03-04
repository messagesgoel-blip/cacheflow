# SCRIPTS KNOWLEDGE BASE

**Generated:** 2026-03-04
**Commit:** N/A
**Branch:** N/A

## OVERVIEW
Orchestration and utility scripts for CacheFlow project management, deployment, and development workflows.

## STRUCTURE
```
./scripts/
├── orchestrate.ts       # Main orchestration script
├── recover.ts           # Recovery and rollback script
├── lib/                # Script utilities and shared functions
├── agent-prompts/      # Claude agent prompt templates
├── update_cacheflow_metrics.py # Python metrics collection
├── [...other scripts]  # Additional utility scripts
└── types.ts            # Script-specific type definitions
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Main Orchestration | orchestrate.ts | Primary workflow automation |
| Recovery | recover.ts | Rollback and recovery operations |
| Utilities | lib/ | Shared script functions |
| AI Agent Prompts | agent-prompts/ | Claude prompts for development |
| Metrics | update_cacheflow_metrics.py | Python metrics collection |

## CONVENTIONS
- TypeScript for complex orchestration scripts
- Python for metrics and data processing
- Idempotent operations where possible
- Comprehensive error handling and logging
- Safe directory configuration for Git

## ANTI-PATTERNS (THIS PROJECT)
- Never assume ports are available - check first
- Don't perform irreversible operations without confirmation
- Avoid giant rewrites - prefer small patch scripts

## UNIQUE STYLES
- Claude integration for development workflows
- Git safety configurations
- Port availability checking
- Automated deployment and rollback procedures