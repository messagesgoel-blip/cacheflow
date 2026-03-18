"use client";

import { 
  Home, 
  Library, 
  Users, 
  ArrowLeftRight, 
  Zap, 
  Link as LinkIcon, 
  Activity, 
  ChevronLeft, 
  ChevronRight, 
  UserPlus 
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface AppRailProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Library, label: "Library", path: "/library" },
  { icon: Users, label: "Spaces", path: "/spaces" },
  { icon: ArrowLeftRight, label: "Transfers", path: "/transfers" },
  { icon: Zap, label: "Automations", path: "/automations" },
  { icon: LinkIcon, label: "Connections", path: "/connections" },
  { icon: Activity, label: "Activity", path: "/activity" },
];

const pinnedSpaces = [
  { label: "Family", emoji: "👨‍👩‍👧‍👦" },
  { label: "Photos", emoji: "📸" },
  { label: "Travel", emoji: "✈️" },
  { label: "Archive", emoji: "📦" },
];

export function AppRail({ isExpanded, onToggleExpanded }: AppRailProps) {
  const pathname = usePathname();
  const width = isExpanded ? "272px" : "64px";

  return (
    <div
      className="h-full flex flex-col border-r transition-all animate-slide-in-left"
      style={{
        width,
        background: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
        transitionDuration: 'var(--transition-base)',
      }}
    >
      {/* Header with household switcher */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-105"
            style={{ background: 'var(--accent-blue)', boxShadow: 'var(--shadow-soft)' }}
          >
            <span className="text-white font-semibold">HP</span>
          </div>
          {isExpanded && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                Homeport
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                Your shared file home
              </div>
            </div>
          )}
          {isExpanded && (
            <button
              onClick={onToggleExpanded}
              className="w-6 h-6 rounded flex items-center justify-center shrink-0 transition-all hover:scale-110"
              style={{ background: 'var(--bg-hover)' }}
            >
              <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>
        {!isExpanded && (
          <button
            onClick={onToggleExpanded}
            className="w-full mt-2 h-6 rounded flex items-center justify-center transition-all hover:bg-[var(--bg-hover)]"
          >
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Workspace section */}
        {isExpanded && (
          <div className="px-3 py-2 text-xs font-medium tracking-wide uppercase animate-fade-in" style={{ color: 'var(--text-muted)' }}>
            Workspace
          </div>
        )}
        
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== "/" && pathname?.startsWith(item.path));
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 rounded-xl transition-all hover:translate-x-0.5 ${
                  isActive ? 'active-nav-item' : ''
                } ${isExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center'}`}
                style={{
                  background: isActive ? 'var(--bg-selected)' : 'transparent',
                  color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  borderLeft: isActive && isExpanded ? '2px solid var(--accent-blue)' : '2px solid transparent',
                }}
                title={!isExpanded ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {isExpanded && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Pinned Spaces */}
        {isExpanded && (
          <>
            <div className="px-3 py-2 mt-6 text-xs font-medium tracking-wide uppercase animate-fade-in" style={{ color: 'var(--text-muted)' }}>
              Pinned Spaces
            </div>
            <div className="space-y-1">
              {pinnedSpaces.map((space) => (
                <button
                  key={space.label}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all hover:bg-[var(--bg-hover)] hover:translate-x-0.5 text-left group"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="text-base shrink-0 transition-transform group-hover:scale-110">{space.emoji}</span>
                  <span className="truncate">{space.label}</span>
                </button>
              ))}
              <button
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all hover:bg-[var(--bg-hover)] text-left text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                <span className="text-lg shrink-0">+</span>
                <span className="truncate">Pin a space</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Bottom section */}
      <div className="p-3 border-t space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
        {isExpanded && (
          <>
            {/* Storage bar */}
            <div className="space-y-2 animate-fade-in">
              <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>4.2 TB of 6.7 TB</span>
                <span>63%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                <div 
                  className="h-full rounded-full transition-all" 
                  style={{ width: '63%', background: 'var(--accent-blue)' }} 
                />
              </div>
            </div>

            {/* Invite button */}
            <button
              className="btn-secondary w-full h-10 flex items-center justify-center gap-2 rounded-xl text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Invite member
            </button>
          </>
        )}
        
        {!isExpanded && (
          <button
            className="w-full h-10 flex items-center justify-center rounded-xl transition-all hover:bg-[var(--bg-hover)]"
            style={{
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
            }}
            title="Invite member"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
