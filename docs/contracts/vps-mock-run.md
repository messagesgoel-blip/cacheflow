# VPS Mock Run

Purpose: preserve existing manual VPS auth entries while keeping QA file operations isolated from real server content.

Scope:
- Connections remain unchanged in `vps_connections`.
- Manual QA should run inside `/srv/storage/local/mock run`.
- Use the dedicated VPS browser or unified browser copy/move flows against that path only.

Canonical mock tree:

```text
/srv/storage/local/mock run
├── readme.txt
├── archive/
│   └── sample.bin
├── level-1/
│   ├── notes.md
│   └── level-2/
│       ├── data.json
│       └── level-3/
│           └── final.txt
└── media/
    └── pixel.png
```

Guidelines:
- Do not test destructive operations in `/`.
- Use `Mock Run` as the first navigation target after opening a VPS connection.
- If transfer checks fail at remote root, retry inside `/srv/storage/local/mock run`.
- Auth issues should be handled by reconnecting only if the saved entry is genuinely broken; file-operation bugs should be reproduced inside the mock tree first.

Manual QA flow:
1. Open the saved VPS entry. Do not recreate the connection unless auth is actually broken.
2. Jump directly to `/srv/storage/local/mock run`.
3. Run browse, preview, upload, copy, move, rename, and delete checks only inside that tree.
4. If a transfer dialog lands at `/`, switch back to `/srv/storage/local/mock run` before confirming.
5. When comparing nodes, expect the same tree shape and filenames on both sides before calling the run synced.

Known note:
- The slower remote VPS can take materially longer to delete/upload via SFTP than the local OCI-backed node. Treat that as transport latency unless the API returns a concrete error.
