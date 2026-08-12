'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';

const Icon = ({ children, size = 20 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const HomeIcon = () => <Icon><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Icon>;
const FileTextIcon = () => <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></Icon>;
const LogOutIcon = () => <Icon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></Icon>;
const BarChartIcon = () => <Icon><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Icon>;
const UsersIcon = () => <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 1-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Icon>;
const WrenchIcon = () => <Icon><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></Icon>;
const SunIcon = () => <Icon size={16}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></Icon>;
const MoonIcon = () => <Icon size={16}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></Icon>;

/** Returns initials (max 2 chars) from a display name */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Consistent hue from a string for the avatar background */
function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/** Avatar circle — photo, initials, or fallback icon */
function UserAvatar({
  imageUrl,
  name,
  size = 'md',
}: {
  imageUrl: string | null;
  name: string;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  if (imageUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={imageUrl}
        alt="Profile"
        className={`${dim} rounded-full object-cover border border-line shrink-0`}
      />
    );
  }
  if (name && name !== 'Administrator') {
    const hue = nameHue(name);
    return (
      <span
        className={`${dim} rounded-full flex items-center justify-center font-bold shrink-0 border border-white/10`}
        style={{ background: `hsl(${hue} 40% 22%)`, color: `hsl(${hue} 60% 72%)` }}
      >
        {getInitials(name)}
      </span>
    );
  }
  return (
    <span className={`${dim} rounded-full bg-ink-800 border border-line flex items-center justify-center text-ink-400 shrink-0`}>
      <UsersIcon />
    </span>
  );
}

export default function Sidebar({
  theme = 'dark',
  onToggleTheme,
  onMobileMenuChange,
}: {
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onMobileMenuChange?: (open: boolean) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Set<string>>(() => new Set());
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const supabase = getSupabaseClient();

  const [role, setRole] = useState<string>('admin');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userScope, setUserScope] = useState<string>('');
  const [userImage, setUserImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || '');
        const { data } = await supabase
          .from('profiles')
          .select('role, entity, facility, pic:pic_id(name, image_profile, entity, facility)')
          .eq('id', session.user.id)
          .single();

        if (data?.role) {
          setRole(data.role);
          const entity = data.entity || data.pic?.entity;
          const facility = data.facility || data.pic?.facility;
          if (entity || facility) {
            setUserScope([entity, facility].filter(Boolean).join(' · '));
          }

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
  }, [pathname, router, supabase]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  const setMobileMenu = (open: boolean) => {
    setMobileOpen(open);
    onMobileMenuChange?.(open);
  };

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => { if (mq.matches) setMobileMenu(false); };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const toggleMenu = (name: string) => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const navTree = [
    {
      name: 'Masterlist',
      href: '/dashboard',
      icon: <HomeIcon />,
      children: [{ name: 'Manage PIC', href: '/dashboard/pics', icon: <UsersIcon /> }],
    },
    { name: 'Inspections', href: '/dashboard/inspections', icon: <FileTextIcon /> },
    {
      name: 'Reports',
      href: '/dashboard/reports',
      icon: <BarChartIcon />,
      children: [{ name: 'Improvements', href: '/dashboard/improvements', icon: <WrenchIcon /> }],
    },
  ];

  const visibleTree = navTree
    .filter((item) => role !== 'inspector' || item.name === 'Inspections' || item.name === 'Reports')
    .map((item) => (item.children ? { ...item, children: item.children } : item));

  const displayName = userName || userEmail || 'Loading...';

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className={`hidden md:flex flex-col bg-ink-950 border-r border-line h-screen sticky top-0 shrink-0 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        {/* Logo row */}
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
          {!isCollapsed && onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors"
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          )}
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-2">
          {!isCollapsed && (
            <div className="px-2 mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">Menu</p>
            </div>
          )}

          {visibleTree.map((item) => {
            const hasChildren = !!item.children?.length;
            const childActive = hasChildren && item.children!.some((c) => pathname === c.href || pathname.startsWith(c.href));
            const isActive = (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) && !childActive;
            const isOpen = openMenus.has(item.name) || childActive;

            return (
              <div key={item.name} className="flex flex-col gap-1">
                <div className={`flex items-center rounded-xl transition-all duration-200 group ${
                  isCollapsed ? 'justify-center' : ''
                } ${
                  isActive || (hasChildren && childActive)
                    ? 'bg-ink-800 text-ember-400 font-medium border border-line shadow-sm'
                    : 'border border-transparent text-ink-400 hover:bg-ink-800/50 hover:text-ink-200'
                }`}>
                  <Link
                    href={item.href}
                    title={isCollapsed ? item.name : undefined}
                    className="flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0 rounded-xl"
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!isCollapsed && <span className="text-sm truncate flex-1">{item.name}</span>}
                  </Link>
                  {hasChildren && !isCollapsed && (
                    <button
                      type="button"
                      onClick={() => toggleMenu(item.name)}
                      title={isOpen ? 'Collapse' : 'Expand'}
                      className="p-2 mr-1.5 rounded-lg text-ink-500 hover:text-ink-300 hover:bg-ink-800 transition-colors"
                    >
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  )}
                </div>

                {hasChildren && !isCollapsed && (
                  <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
                    <div className="ml-[1.35rem] pl-3.5 border-l border-ink-800 flex flex-col gap-0.5 py-1">
                      {item.children!.map((child) => {
                        const childIsActive = pathname === child.href || pathname.startsWith(child.href);
                        return (
                          <Link
                            key={child.name}
                            href={child.href}
                            title={isCollapsed ? child.name : undefined}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                              childIsActive
                                ? 'text-ember-400 font-medium bg-ink-800/60'
                                : 'text-ink-400 hover:text-ink-200 hover:bg-ink-800/40'
                            }`}
                          >
                            <span className="shrink-0">{child.icon}</span>
                            <span className="truncate">{child.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Bottom user block + sign out ── */}
        <div className="p-3 border-t border-line space-y-2">
          {/* Back to top button */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title={isCollapsed ? 'Back to Top' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-ink-400 hover:text-ink-200 hover:bg-ink-800/60 border border-line/50 text-xs font-medium transition-all ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            {!isCollapsed && <span>Back to Top</span>}
          </button>

          {/* User info card */}
          <div className={`flex items-center gap-3 px-2 py-2 rounded-xl bg-ink-900/60 border border-line/50 ${isCollapsed ? 'justify-center' : ''}`}>
            <UserAvatar imageUrl={userImage} name={userName} size="md" />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-ink-200 truncate">{displayName}</span>
                <span className="text-[11px] text-ink-500 truncate capitalize">
                  {role === 'admin' ? 'Admin User' : role}
                  {userScope && <span className="text-[10px] text-ember-400 block truncate">{userScope}</span>}
                </span>
              </div>
            )}
          </div>

          {/* Sign out button */}
          <button
            onClick={handleSignOut}
            title={isCollapsed ? 'Sign Out' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-500 hover:bg-ink-700/20 border border-transparent hover:border-ink-700/30 text-xs font-medium transition-all ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <LogOutIcon />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Bar ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-ink-950/95 backdrop-blur-xl border-b border-line">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenu(true)}
            aria-label="Open menu"
            className="p-2 -ml-2 rounded-lg text-ink-400 hover:text-ink-200 hover:bg-ink-800 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ember-600/15 text-ember-400 border border-ember-900/50">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 4 6v6c0 4.4 3.2 7.7 8 9 4.8-1.3 8-4.6 8-9V6l-8-3Z" />
            </svg>
          </div>
          <span className="font-semibold text-ink-100 tracking-tight">System Hub</span>
        </div>
      </header>

      {/* ── Mobile Drawer Menu ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenu(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-ink-950 border-r border-line flex flex-col shadow-2xl">
            <div className="h-14 flex items-center justify-between px-4 border-b border-line">
              <span className="font-semibold text-ink-100 tracking-tight">System Hub</span>
              <button
                                onClick={() => setMobileMenu(false)}
                aria-label="Close menu"
                className="p-2 -mr-2 rounded-lg text-ink-400 hover:text-ink-200 hover:bg-ink-800 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
              {visibleTree.map((item) => {
                const hasChildren = !!item.children?.length;
                const childActive = hasChildren && item.children!.some((c) => pathname === c.href || pathname.startsWith(c.href));
                const isActive = (pathname === item.href || pathname.startsWith(item.href)) && !childActive;
                const isOpen = openMenus.has(item.name) || childActive;

                return (
                  <div key={item.name} className="flex flex-col gap-0.5">
                    <div className={`flex items-center rounded-xl transition-colors ${
                      isActive || (hasChildren && childActive)
                        ? 'bg-ink-800 text-ember-400 font-medium border border-line'
                        : 'text-ink-400 border border-transparent'
                    }`}>
                      <Link
                        href={item.href}
                        onClick={() => { if (!hasChildren) setMobileMenu(false); }}
                        className="flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0"
                      >
                        <span className="shrink-0">{item.icon}</span>
                        <span className="text-sm truncate">{item.name}</span>
                      </Link>
                      {hasChildren && (
                        <button
                          type="button"
                          onClick={() => toggleMenu(item.name)}
                          title={isOpen ? 'Collapse' : 'Expand'}
                          className="p-2 mr-1.5 rounded-lg text-ink-500 hover:text-ink-300 hover:bg-ink-800 transition-colors"
                        >
                          <svg
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {hasChildren && (
                      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
                        <div className="ml-[1.35rem] pl-3.5 border-l border-ink-800 flex flex-col gap-0.5 py-1">
                          {item.children!.map((child) => {
                            const childIsActive = pathname === child.href || pathname.startsWith(child.href);
                            return (
                              <Link
                                key={child.name}
                                href={child.href}
                onClick={() => setMobileMenu(false)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                  childIsActive
                                    ? 'text-ember-400 font-medium bg-ink-800/60'
                                    : 'text-ink-400 hover:text-ink-200 hover:bg-ink-800/40'
                                }`}
                              >
                                <span className="shrink-0">{child.icon}</span>
                                <span className="truncate">{child.name}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-line space-y-2">
              <button
                onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setMobileMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-ink-400 hover:text-ink-200 hover:bg-ink-800/60 border border-line/50 text-xs font-medium transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                <span>Back to Top</span>
              </button>
              <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-ink-900/60 border border-line/50">
                <UserAvatar imageUrl={userImage} name={userName} size="md" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-ink-200 truncate">{displayName}</span>
                  <span className="text-[11px] text-ink-500 truncate capitalize">
                    {role === 'admin' ? 'Admin User' : role}
                    {userScope && <span className="text-[10px] text-ember-400 block truncate">{userScope}</span>}
                  </span>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-500 hover:bg-ink-700/20 text-xs font-medium transition-colors"
              >
                <LogOutIcon />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
