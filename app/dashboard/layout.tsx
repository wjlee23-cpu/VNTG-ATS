'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/modern/Sidebar';
import { TopBar } from '@/components/modern/TopBar';
import { CommandPalette } from '@/components/modern/CommandPalette';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [commandOpen, setCommandOpen] = useState(false);

  // Command Palette shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen bg-[#FAFAFA] overflow-hidden">
      {/* Minimal Icon Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="md:ml-16 ml-0 h-full flex flex-col min-w-0 transition-all duration-300">
        {/* Top Bar */}
        <TopBar onCommandOpen={() => setCommandOpen(true)} />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette 
        open={commandOpen} 
        onClose={() => setCommandOpen(false)}
      />
    </div>
  );
}
