'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShieldCheck, 
  History, 
  Activity, 
  Menu, 
  X,
  Factory
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Quality Review', href: '/review', icon: ShieldCheck },
    { name: 'Audit History', href: '/history', icon: History },
  ];

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white"
        aria-label="Toggle Sidebar"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-gray-800 bg-[#090d16] p-6 transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col justify-between`}
      >
        <div>
          {/* Brand Logo */}
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-500/20">
              <Factory size={22} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-md font-bold tracking-tight text-white leading-none">AI MANUF.</h1>
              <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest">Workflow Engine</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-white' : 'text-gray-400'} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer/System Status Card */}
        <div className="border border-gray-800 bg-gray-950/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-emerald-500" />
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">System Status</span>
          </div>
          <div className="text-xs text-gray-500 flex flex-col gap-1">
            <div className="flex justify-between">
              <span>Nodes Connected:</span>
              <span className="text-emerald-400 font-mono">5/5</span>
            </div>
            <div className="flex justify-between">
              <span>DB Status:</span>
              <span className="text-emerald-400 font-mono">ONLINE</span>
            </div>
            <div className="flex justify-between">
              <span>Engine Version:</span>
              <span className="text-gray-300 font-mono">v1.2.0</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
