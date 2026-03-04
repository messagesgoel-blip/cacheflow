type RefreshFn = () => Promise<string>;

class RefreshGuard {
  private refreshPromise: Promise<string> | null = null;
  private refreshFn: RefreshFn;

  constructor(refreshFn: RefreshFn) {
    this.refreshFn = refreshFn;
  }

  async getToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.executeRefresh();
    return this.refreshPromise;
  }

  private async executeRefresh(): Promise<string> {
    try {
      return await this.refreshFn();
    } finally {
      this.refreshPromise = null;
    }
  }

  isRefreshing(): boolean {
    return this.refreshPromise !== null;
  }

  reset(): void {
    this.refreshPromise = null;
  }
}

let defaultGuard: RefreshGuard | null = null;

export function initRefreshGuard(refreshFn: RefreshFn): RefreshGuard {
  defaultGuard = new RefreshGuard(refreshFn);
  return defaultGuard;
}

export function getRefreshGuard(): RefreshGuard {
  if (!defaultGuard) {
    throw new Error('RefreshGuard not initialized. Call initRefreshGuard first.');
  }
  return defaultGuard;
}

export { RefreshGuard };
