# Vault Naming Decision

## Selected User-Facing Name

**Private Folder**

## Rationale

The recommended user-facing name is **Private Folder** (not "Vault") for the following reasons:

1. **Clarity**: "Private Folder" immediately communicates the concept of privacy to average users
2. **Familiarity**: Similar naming patterns exist in other cloud services (e.g., OneDrive Personal Vault, Dropbox Vault)
3. **Encryption Misconception**: Using "Vault" may imply military-grade encryption which is not implemented. "Folder" is more accurate as it reflects the actual functionality without overpromising security.

## Technical Reference

- Internal identifier: `vault` (used in database, APIs, code)
- User-facing name: **Private Folder**
- Displayed with a lock icon (🔒) in the sidebar

## Disclaimer Requirements

All user-facing surfaces must include a non-encryption disclaimer:

1. **Setup**: Display disclaimer when enabling Private Folder for the first time
2. **Unlock Modal**: Show disclaimer in the PIN entry modal
3. **Folder Header**: Include disclaimer in the Private Folder view header

## Implementation Notes

The disclaimer text should be:
> "Private Folder hides files from All Files and search, but does not provide encryption. Your files remain accessible to anyone with provider access."

This ensures transparency about what the feature actually does versus what users might expect from a "vault" product.

