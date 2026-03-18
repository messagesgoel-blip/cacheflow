"use client";

import { ReactNode, useState } from "react";
import { AppRail } from "./AppRail";
import { CommandBar } from "./CommandBar";
import { MobileNav } from "./MobileNav";
import { DetailDrawer } from "./DetailDrawer";
import { CommandPalette } from "./CommandPalette";

/**
 * Props for the AppShell component.
 */
interface AppShellProps {
  /** The main content to be rendered within the shell. */
  children: ReactNode;
}

/**
 * Global application shell that provides the core layout structure, 
 * including the navigation rail, command bar, and detail drawer.
 * It manages the state for expanded navigation and side panels.
 */
export function AppShell({ children }: AppShellProps) {
  const [isRailExpanded, setIsRailExpanded] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  /**
   * Opens the detail drawer for a specific item.
   * @param item - The file or space item to show details for.
   */
  const handleOpenDrawer = (item: any) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
  };

  /**
   * Closes the detail drawer and clears the selected item.
   */
  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ background: 'var(--bg-app)' }}>
      {/* Command Bar - Always visible */}
      <CommandBar onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Rail - Hidden on mobile */}
        <div className="hidden md:block">
          <AppRail 
            isExpanded={isRailExpanded} 
            onToggleExpanded={() => setIsRailExpanded(!isRailExpanded)} 
          />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto relative">
          {children}
        </main>

        {/* Detail Drawer - Desktop only, slides from right */}
        {isDrawerOpen && (
          <div className="hidden md:block">
            <DetailDrawer
              isOpen={isDrawerOpen}
              onClose={handleCloseDrawer}
              item={selectedItem}
            />
          </div>
        )}
      </div>

      {/* Mobile Nav - Only on mobile */}
      <div className="md:hidden">
        <MobileNav />
      </div>

      {/* Command Palette - Global */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
