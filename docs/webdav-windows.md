# CacheFlow WebDAV — Windows Connection Guide

## Connection Details
- URL: https://cacheflow-files.goels.in
- Username: sanjay
- Password: (see WEBDAV_PASS in .env on server)

## Steps — Windows 10/11
1. Open File Explorer
2. Right-click "This PC" → "Map Network Drive"
3. Choose a drive letter (e.g. Z:)
4. Folder: https://cacheflow-files.goels.in
5. Check "Connect using different credentials"
6. Click Finish
7. Enter username: sanjay and password from .env

## Alternative: Web Folders
- Open Run (Win+R) → type: https://cacheflow-files.goels.in → OK
- Enter credentials when prompted

## Known Windows WebDAV Issues
- Windows caches WebDAV credentials aggressively — use Credential Manager to clear
- Large directory trees may be slow (WebDAV limitation — pilot bridge only)
- If mapping fails, try: net use Z: https://cacheflow-files.goels.in /user:sanjay <password>

## Known Limitations (Pilot Bridge)
Post-MVP: replaced with WinFSP native daemon.

