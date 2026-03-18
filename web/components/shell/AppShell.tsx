"use client";

import { ReactNode, useState } from "react";
import { AppRail } from "./AppRail";
import { CommandBar } from "./CommandBar";
import { MobileNav } from "./MobileNav";
import { DetailDrawer } from "./DetailDrawer";
import { CommandPalette } from "./CommandPalette";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isRailExpanded, setIsRailExpanded] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const handleOpenDrawer = (item: any) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
  };

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
