# CacheFlow WebDAV — macOS Connection Guide

## Connection Details
- URL: https://cacheflow-files.goels.in
- Username: sanjay
- Password: (see WEBDAV_PASS in .env on server)

## Steps
1. Open Finder
2. Press Cmd+K (Connect to Server)
3. Enter: https://cacheflow-files.goels.in
4. Click Connect
5. Enter username: sanjay and password from .env
6. The /mnt/pool contents should appear as a network drive

## Verify
- Can browse folders
- Can open a text file
- Note: Write is disabled (mounted :ro) — read-only for pilot

## Known Limitations (Pilot Bridge)
WebDAV is a pilot-era bridge. Post-MVP this will be replaced with a
native macFUSE daemon for true NVMe-speed desktop sync.

