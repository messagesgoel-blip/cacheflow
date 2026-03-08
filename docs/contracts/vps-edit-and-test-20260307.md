# VPS Edit And Test Flow

## Scope
- allow saved VPS labels and connection details to be edited
- add a non-saving `Test Connection` action before creating a VPS
- allow existing saved VPS connections to be re-tested from the provider card

## UI contract
- `Connect VPS / SFTP` now has separate `Test Connection` and `Save VPS` actions
- `Edit VPS / SFTP` pre-fills the saved label, host, port, and username
- editing only the label does not force a new connection test
- changing host, port, username, or PEM requires a fresh successful test before save
- existing VPS cards expose `Test Connection` and `Edit Details`
- successful modal tests display the SSH host fingerprint inline so the user can verify the remote server identity

## API contract
- `POST /api/providers/vps/test`
- `POST /api/providers/vps/:id/test`
- `PATCH /api/providers/vps/:id`

## Validation
- create mode requires PEM upload
- edit mode keeps the stored PEM unless a replacement file is uploaded
- save routes still run a server-side SSH/SFTP dry-run before persisting
