'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { useEffect } from 'react';

const Icon = ({ children, size = 20 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const HomeIcon = () => <Icon><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Icon>;
const UsersIcon = () => <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 1 16 3.13A4 4 0 0 1 16 11" /></Icon>;
const FileTextIcon = () => <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></Icon>;
const LogOutIcon = () => <Icon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></Icon>;
const BarChartIcon = () => <Icon><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Icon>;

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const supabase = getSupabaseClient();

  const [role, setRole] = useState<string>('admin');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userImage, setUserImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || '');
        const { data } = await supabase.from('profiles').select('role, pic:pic_id(name, image_profile)').eq('id', session.user.id).single() as any;
        if (data?.role) {
          setRole(data.role);
          if (data.pic?.name) {
            setUserName(data.pic.name);
            if (data.pic.image_profile) {
              setUserImage(data.pic.image_profile);
            }
          } else {
            setUserName('Administrator');
          }
          if (data.role === 'inspector' && (pathname === '/dashboard' || pathname === '/dashboard/pics')) {
            router.push('/dashboard/inspections');
          }
        }
      }
    };
    fetchRole();
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  let navItems = [
    { name: 'Masterlist', href: '/dashboard', icon: <HomeIcon /> },
    { name: 'Inspections', href: '/dashboard/inspections', icon: <FileTextIcon /> },
    { name: 'Reports', href: '/dashboard/reports', icon: <BarChartIcon /> },
    { name: 'Manage PICs', href: '/dashboard/pics', icon: <UsersIcon /> },
  ];

  if (role === 'inspector') {
    navItems = navItems.filter(item => item.name === 'Inspections' || item.name === 'Reports');
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col bg-ink-950 border-r border-line h-screen sticky top-0 shrink-0 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`h-16 flex items-center border-b border-line ${isCollapsed ? 'justify-center px-2' : 'justify-between px-6'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ember-600/15 text-ember-400 border border-ember-900/50 shrink-0">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 4 6v6c0 4.4 3.2 7.7 8 9 4.8-1.3 8-4.6 8-9V6l-8-3Z" />
              </svg>
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-ink-100 tracking-tight text-lg truncate">System Hub</span>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isCollapsed ? (
                <path d="m13 17 5-5-5-5M6 17l5-5-5-5" />
              ) : (
                <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
              )}
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-2">
          {!isCollapsed && (
            <div className="px-2 mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">Menu</p>
            </div>
          )}
          
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                  isCollapsed ? 'justify-center' : ''
                } ${
                  isActive 
                    ? 'bg-ink-800 text-ember-400 font-medium border border-line shadow-sm' 
                    : 'text-ink-400 hover:bg-ink-800/50 hover:text-ink-200 border border-transparent'
                }`}
              >
                <span className={`transition-colors duration-200 shrink-0 ${isActive ? 'text-ember-400' : 'text-ink-500 group-hover:text-ink-400'}`}>
                  {item.icon}
                </span>
                {!isCollapsed && <span className="text-sm truncate">{item.name}</span>}
              </Link>
            );
          })}
        </div>
        
        <div className="p-3 border-t border-line space-y-3">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-2'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-ink-800 border border-line flex items-center justify-center text-ink-400 shrink-0 overflow-hidden">
                {userImage ? (
                  <img src={userImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UsersIcon />
                )}
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-ink-200 truncate">{userName || userEmail || 'Loading...'}</span>
                  <span className="text-[11px] text-ink-500 truncate capitalize">{role} {role === 'admin' ? 'User' : ''}</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSignOut}
            title={isCollapsed ? 'Sign Out' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 text-xs font-medium transition-all ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <LogOutIcon />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-ink-950/95 backdrop-blur-xl border-t border-line px-2 py-1.5 flex items-center justify-around shadow-2xl">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all ${
                isActive
                  ? 'text-ember-400 font-semibold'
                  : 'text-ink-500 hover:text-ink-300'
              }`}
            >
              <div className={`p-1 rounded-lg ${isActive ? 'bg-ember-600/15 border border-ember-900/40' : ''}`}>
                {item.icon}
              </div>
              <span className="text-[10px] tracking-tight">{item.name}</span>
            </Link>
          );
        })}

        <button
          onClick={handleSignOut}
          className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl text-rose-400 hover:text-rose-300 transition-all"
        >
          <div className="p-1 rounded-lg">
            <LogOutIcon />
          </div>
          <span className="text-[10px] tracking-tight">Sign Out</span>
        </button>
      </nav>
    </>
  );
}
