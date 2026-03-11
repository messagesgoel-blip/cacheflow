# URM-70: APP-01 Upload Invalidation Fix

## Scope

Fix upload/list invalidation after successful upload to ensure proper UI updates.

## Issues Identified

1. Upload/list invalidation not working properly after successful upload
2. Upload response not returning the created file object
3. Downstream rename/version/trash/share selector cascades not being triggered

## Solution Approach

1. Modify upload API to return the created file object
2. Implement proper cache invalidation after successful upload
3. Ensure file list refreshes after upload completion
4. Maintain focus on upload mutation and returned payload

## Files Modified

- `web/app/api/remotes/[uuid]/upload/route.ts` - Update upload route to return file object
- `web/lib/api.ts` - Update uploadFile function to handle returned file object
- `web/components/FileBrowser.tsx` - Update to handle file list refresh after upload

## Verification

- Upload returns created file object
- File list updates automatically after upload
- Downstream selectors (rename/version/trash/share) work properly
