# UUID Upload Pipeline Audit — 2026-03-02

## Scope
- Task: `1.12@UUID-1` (audit upload pipeline for UUID injection)
- Task: `1.15@UUID-1` (validate migration readiness and execution path)
- Repo: `/opt/docker/apps/cacheflow`

## Commands Run
```bash
cd /opt/docker/apps/cacheflow
rg -n "uuid|randomUUID|crypto\\.random|nanoid|upload" web/lib api/src scripts -g '*.ts' -g '*.js'
sed -n '280,380p' web/lib/providers/googleDrive.ts
sed -n '250,360p' web/lib/providers/dropbox.ts
sed -n '240,340p' web/lib/providers/oneDrive.ts
sed -n '120,220p' web/lib/providers/pcloud.ts
sed -n '1,180p' api/src/routes/files.js
```

## Findings
1. Provider upload adapters preserve file names:
- `googleDrive.ts`: uses `options?.fileName || file.name` and uploads metadata `name: fileName`.
- `dropbox.ts`: composes remote path from `fileName` (`options?.fileName || file.name`).
- `oneDrive.ts`: uses `fileName` derived from `options?.fileName || file.name`.
- `pcloud.ts`: posts multipart field `filename` as `options?.fileName || file.name`.

2. Server upload route preserves original names:
- `api/src/routes/files.js` multer storage uses `path.basename(file.originalname)` and request path normalization appends `req.file.originalname` for directory uploads.
- No UUID prefixing logic found in the server upload write path.

3. UUID/random generation sites found in repo are not upload-name injectors:
- request IDs, OAuth state/nonce, token creation, and generic identifiers.
- No active code path found that prepends UUIDs to uploaded file names/paths in provider adapters or `/files/upload`.

## Migration Validation (`1.15@UUID-1`)
Dry-run executed against the active local CacheFlow Postgres endpoint:

```bash
cd /opt/docker/apps/cacheflow
DATABASE_URL='postgresql://cacheflow:changeme123@127.0.0.1:5433/cacheflow' \
NODE_PATH=/opt/docker/apps/cacheflow/api/node_modules \
node scripts/migrate-files-no-uuid.js --dry-run
```

Result:
- `Total files: 283`
- `Would migrate: 0`

Interpretation:
- Existing dataset contains no UUID-prefixed paths requiring migration at this time.
- Migration apply step is currently a no-op for this environment.

## Conclusion
- `1.12@UUID-1`: audit complete, no active UUID filename injection point found.
- `1.15@UUID-1`: migration validated via dry-run, no rows/files pending migration.

