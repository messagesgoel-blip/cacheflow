"use client";

import { Home, Library, Search, Activity, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Bottom navigation bar optimized for mobile devices.
 * Provides quick access to main sections like Home, Library, and Activity.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <div
      className="h-14 border-t flex items-center justify-around px-2 safe-area-inset-bottom bg-[var(--bg-surface)] border-[var(--border-subtle)]"
    >
      <Link
        href="/"
        data-testid="nav-home"
        aria-label="Home"
        className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg min-w-0 ${
          pathname === '/' ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-xs">Home</span>
      </Link>

      <Link
        href="/library"
        data-testid="nav-library"
        aria-label="Library"
        className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg min-w-0 ${
          pathname?.startsWith('/library') ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]'
        }`}
      >
        <Library className="w-5 h-5" />
        <span className="text-xs">Library</span>
      </Link>

      <button
        data-testid="nav-search"
        aria-label="Search"
        className="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg min-w-0 text-[var(--text-secondary)] opacity-50"
        disabled
      >
        <Search className="w-5 h-5" />
        <span className="text-xs">Search</span>
      </button>

      <Link
        href="/activity"
        data-testid="nav-activity"
        aria-label="Activity"
        className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg min-w-0 ${
          pathname?.startsWith('/activity') ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]'
        }`}
      >
        <Activity className="w-5 h-5" />
        <span className="text-xs">Activity</span>
      </Link>

      <button
        data-testid="nav-more"
        aria-label="More"
        className="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg min-w-0 text-[var(--text-secondary)] opacity-50"
        disabled
      >
        <MoreHorizontal className="w-5 h-5" />
        <span className="text-xs">More</span>
      </button>
    </div>
  );
}
