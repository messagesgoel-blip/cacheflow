# Transfers Surface Polish

Date: 2026-03-08

Goal:
- borrow the example UI's transfer summary and progress-card treatment without changing transfer behavior or backend contracts

Scope:
- refresh `TransferQueuePanel` with:
  - summary counters for active/completed/failed jobs
  - denser route and status chips
  - clearer progress and byte counters
- refresh `TransferModal` with:
  - operation summary cards
  - stronger destination context
  - more structured folder browser styling

Non-goals:
- no new transfer states
- no schedules merge yet
- no changes to queue execution, retries, or provider transfer logic

Validation:
- focused Playwright on copy and move transfer modal flows
