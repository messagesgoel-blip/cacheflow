export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || Number.isNaN(bytes)) {
    return '0 B';
  }

  const normalizedBytes = Math.max(0, bytes);

  if (normalizedBytes < 1024) return `${normalizedBytes} B`;
  if (normalizedBytes < 1024 * 1024) return `${(normalizedBytes / 1024).toFixed(1)} KB`;
  if (normalizedBytes < 1024 * 1024 * 1024) return `${(normalizedBytes / (1024 * 1024)).toFixed(1)} MB`;
  if (normalizedBytes < 1024 * 1024 * 1024 * 1024) {
    return `${(normalizedBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return `${(normalizedBytes / (1024 * 1024 * 1024 * 1024)).toFixed(1)} TB`;
}
