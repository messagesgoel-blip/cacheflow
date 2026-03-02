# CacheFlow
Personal hybrid cloud storage — NVMe cache + rclone sync.

## Provider Setup
- Detailed step-by-step provider setup (Google Drive, OneDrive, Dropbox, Box, pCloud, Filen, Yandex, WebDAV, VPS/SFTP):
  - `PROVIDER_SETUP.md`

## Ports
- API (Express): 8100
- Web (Next.js): 3010
- WebDAV: 8180
- PostgreSQL: 5433

## Tests
- Run all suites (web, api, worker): `./test-all.sh`
- Web-only: `cd web && npm test -- --runInBand`
- API-only: `cd api && npm test -- --runInBand`
- Worker-only: `cd worker && npm test -- --runInBand`
