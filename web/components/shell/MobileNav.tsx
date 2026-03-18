"use client";

import { Home, Library, Search, Activity, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div
      className="h-14 border-t flex items-center justify-around px-2 safe-area-inset-bottom"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <Link
        href="/"
        data-testid="nav-home"
        aria-label="Home"
        className="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg min-w-0"
        style={{
          color: pathname === '/' ? 'var(--accent-blue)' : 'var(--text-secondary)',
        }}
      >
        <Home className="w-5 h-5" />
        <span className="text-xs">Home</span>
      </Link>

      <Link
        href="/library"
        data-testid="nav-library"
        aria-label="Library"
        className="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg min-w-0"
        style={{
          color: pathname?.startsWith('/library') ? 'var(--accent-blue)' : 'var(--text-secondary)',
        }}
      >
        <Library className="w-5 h-5" />
        <span className="text-xs">Library</span>
      </Link>

      <button
        data-testid="nav-search"
        aria-label="Search"
        className="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg min-w-0"
        disabled
        style={{ color: 'var(--text-secondary)', opacity: 0.5 }}
      >
        <Search className="w-5 h-5" />
        <span className="text-xs">Search</span>
      </button>

      <Link
        href="/activity"
        data-testid="nav-activity"
        aria-label="Activity"
        className="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg min-w-0"
        style={{
          color: pathname?.startsWith('/activity') ? 'var(--accent-blue)' : 'var(--text-secondary)',
        }}
      >
        <Activity className="w-5 h-5" />
        <span className="text-xs">Activity</span>
      </Link>

      <button
        data-testid="nav-more"
        aria-label="More"
        className="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg min-w-0"
        disabled
        style={{ color: 'var(--text-secondary)', opacity: 0.5 }}
      >
        <MoreHorizontal className="w-5 h-5" />
        <span className="text-xs">More</span>
      </button>
    </div>
  );
}
