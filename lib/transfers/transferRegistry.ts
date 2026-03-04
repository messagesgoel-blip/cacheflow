/**
 * Gate: TRANSFER-1
 * Task: 3.3@TRANSFER-1
 */

export type FileOperation = 'delete' | 'move' | 'rename' | 'download';

export type TrayEntryStatus = 'completed' | 'failed';

export interface TrayEntry {
  id: string;
  remoteUuid: string;
  provider: string;
  fileId: string;
  fileName?: string;
  operation: FileOperation;
  status: TrayEntryStatus;
  error?: string;
  timestamp: number;
  userId: string;
  toastMessage: string;
}

export interface RecordOptions {
  remoteUuid: string;
  provider: string;
  fileId: string;
  fileName?: string;
  operation: FileOperation;
  status: TrayEntryStatus;
  error?: string;
  toastMessage: string;
}

const MAX_ENTRIES_PER_USER = 50;

class TransferRegistry {
  private readonly store = new Map<string, TrayEntry[]>();

  record(userId: string, opts: RecordOptions): TrayEntry {
    const entry: TrayEntry = {
      id: `${opts.operation}-${userId}-${Date.now()}`,
      userId,
      remoteUuid: opts.remoteUuid,
      provider: opts.provider,
      fileId: opts.fileId,
      fileName: opts.fileName,
      operation: opts.operation,
      status: opts.status,
      error: opts.error,
      timestamp: Date.now(),
      toastMessage: opts.toastMessage,
    };

    const existing = this.store.get(userId) ?? [];
    this.store.set(userId, [entry, ...existing].slice(0, MAX_ENTRIES_PER_USER));

    return entry;
  }

  getEntries(userId: string): TrayEntry[] {
    return this.store.get(userId) ?? [];
  }

  getEntriesSince(userId: string, since: number): TrayEntry[] {
    return this.getEntries(userId).filter(e => e.timestamp > since);
  }

  dismiss(userId: string, entryId: string): void {
    const existing = this.store.get(userId);
    if (!existing) return;
    this.store.set(userId, existing.filter(e => e.id !== entryId));
  }

  clearUser(userId: string): void {
    this.store.delete(userId);
  }

  totalEntries(): number {
    let total = 0;
    for (const entries of this.store.values()) {
      total += entries.length;
    }
    return total;
  }
}

export const transferRegistry = new TransferRegistry();
