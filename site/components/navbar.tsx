"use client"

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User as AuthUser } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';
import { PROFILE_COLUMNS, toProfile, DEFAULT_AVATAR, PROFILE_UPDATED_EVENT } from '@/lib/data/profile-shape';
import { User, Upload, LogOut, ShieldCheck, Menu, X, Bell } from 'lucide-react';

const NavBar = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [user, setUser] = useState<AuthUser | null>(null); // session user
    const [profile, setProfile] = useState<Profile | null>(null); // full user profile
    const [loading, setLoading] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const [isMobile, setIsMobile] = useState(false);
    const [scrolled, setScrolled] = useState(false); // tint the bar once content scrolls under it
    const [hasUnseenNotices, setHasUnseenNotices] = useState(false);
    const pathname = usePathname();
    const avatarRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null); // the bar and the phone menu
    const supabase = createClient();

    useEffect(() => {
        let mounted = true;

        // Check if mobile
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);

        const loadProfile = async (userId: string) => {
            const [{ data: profileData }, { data: unseen }] = await Promise.all([
                supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single(),
                supabase.rpc('has_unseen_notices'),
            ]);
            if (mounted) {
                setProfile(toProfile(profileData));
                setHasUnseenNotices(Boolean(unseen));
            }
        };

        // Get initial session
        const getInitialSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!mounted) return;
                
                setUser(session?.user || null);
                if (session?.user) {
                    await loadProfile(session.user.id);
                } else {
                    setProfile(null);
                    setHasUnseenNotices(false);
                }
            } catch (error) {
                console.error('Error getting initial session:', error);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        getInitialSession();

        // The navbar loads the profile once; reload it when you save yours.
        const onProfileUpdated = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) await loadProfile(session.user.id);
        };
        window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);

        // Listen for auth changes. The callback must stay synchronous: supabase-js
        // runs it while holding its auth lock, and any Supabase call awaited in
        // here waits on that same lock -- a deadlock that froze every other auth
        // call on the page (e.g. updateUser on the password reset form).
        // Defer the profile query until after the lock is released.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (!mounted) return;
                
                setUser(session?.user || null);
                if (session?.user) {
                    setTimeout(() => {
                        loadProfile(session.user.id).finally(() => {
                            if (mounted) setLoading(false);
                        });
                    }, 0);
                } else {
                    setProfile(null);
                    setHasUnseenNotices(false);
                    setLoading(false);
                }
            }
        );

        // Close dropdown on outside click
        const handleClickOutside = (event: MouseEvent) => {
            // Don't close if clicking on a link inside the dropdown
            const target = event.target as Element;
            if (target.closest('a')) {
                return;
            }
            
            // Check if click is outside both the avatar and the dropdown area
            const isOutsideAvatar = avatarRef.current && !avatarRef.current.contains(event.target as Node);
            const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(event.target as Node);
            
            if (isOutsideAvatar && isOutsideDropdown) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            mounted = false;
            subscription.unsubscribe();
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
        };
    }, [supabase]);

    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setHasUnseenNotices(false);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // Opening /notices marks everything read server-side; hide the dot right
    // away rather than waiting for a remount to re-check has_unseen_notices.
    const showNoticesDot = hasUnseenNotices && pathname !== '/notices';

    // The hover dropdown is for wide screens; phones get the menu instead.
    const handleDropdownShow = () => {
        if (isMobile) return;
        if (avatarRef.current) {
            const rect = avatarRef.current.getBoundingClientRect();
            const dropdownWidth = 200;
            const wouldOverflowRight = rect.right + dropdownWidth > window.innerWidth;
            setDropdownPosition({
                top: rect.bottom + 8,
                left: wouldOverflowRight ? rect.left - dropdownWidth : rect.right
            });
        }
        setDropdownOpen(true);
    };

    const handleDropdownHide = () => {
        // Add a small delay to allow moving mouse to dropdown
        setTimeout(() => {
            // Check if mouse is over dropdown before closing
            if (dropdownRef.current && !dropdownRef.current.matches(':hover')) {
                setDropdownOpen(false);
            }
        }, 100);
    };

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // The phone menu closes on Escape, on a tap outside the bar and menu, and
    // when the window grows past the breakpoint (the links are back in the bar).
    useEffect(() => {
        if (!isMobileMenuOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMobileMenuOpen(false); };
        const onDown = (e: PointerEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMobileMenuOpen(false);
        };
        const onResize = () => { if (window.innerWidth >= 768) setIsMobileMenuOpen(false); };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onDown);
        window.addEventListener('resize', onResize);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onDown);
            window.removeEventListener('resize', onResize);
        };
    }, [isMobileMenuOpen]);

    // Picking a menu item closes both the phone menu and the desktop dropdown.
    const closeMenu = () => { setIsMobileMenuOpen(false); setDropdownOpen(false); };
    const isAuthenticated = !!user;
    const isModerator = profile?.role === 'moderator' || profile?.role === 'admin';
    const menuItem = 'px-4 py-3 rounded-xl hover:bg-white/10 transition-colors duration-200 flex items-center gap-3';

    return (
        <div className="fixed w-full z-50" ref={menuRef}>
            {/* Navbar */}
            <nav data-scrolled={scrolled || undefined}
                 className={`fixed top-10 left-1/2 -translate-x-1/2 z-50
                            backdrop-blur-md text-white transition-colors duration-300
                            ${scrolled ? 'bg-black/40' : 'bg-transparent'}
                            shadow-lg text-sm font-medium border-2 border-white/10
                            px-4 py-3 rounded-2xl md:px-12 md:py-4 md:rounded-full
                            flex items-center justify-center w-auto`}>
                <div className="flex items-center gap-4 md:gap-8">
                    <Link href="/" className="flex-shrink-0" onClick={closeMenu}>
                        <Image
                            src="/waves.png"
                            alt="Wallpy Logo"
                            width={48}
                            height={48}
                            className="w-8 h-8"
                        />
                    </Link>
                    <div className="flex items-center gap-4 md:gap-8">
                        <Link href="/docs" className="hidden md:inline hover:underline whitespace-nowrap">Docs</Link>
                        <Link href="/gallery" className="hidden md:inline hover:underline whitespace-nowrap">Gallery</Link>
                        {loading ? (
                            <div className="w-9 h-9 rounded-full bg-white/10 animate-pulse"></div>
                        ) : isAuthenticated ? (
                            <div
                                className="relative flex items-center gap-2"
                                ref={avatarRef}
                                onMouseEnter={handleDropdownShow}
                                onMouseLeave={handleDropdownHide}
                            >
                                <Link href={`/profile/${profile?.username}`} className="relative flex items-center gap-2 focus:outline-none" onClick={closeMenu}>
                                    <Image
                                        src={profile?.avatar_url || DEFAULT_AVATAR}
                                        alt={profile?.name || profile?.username || "User"}
                                        width={36}
                                        height={36}
                                        className="rounded-full border-2 border-white/20 object-cover w-9 h-9 bg-white/10 hover:border-white/40 transition-colors duration-200"
                                    />
                                    {showNoticesDot && (
                                        <span
                                            data-testid="notices-dot"
                                            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-black/60"
                                        />
                                    )}
                                </Link>
                            </div>
                        ) : (
                            <Link href="/auth/login" className="hover:underline whitespace-nowrap" onClick={closeMenu}>Sign In</Link>
                        )}
                        <button
                            type="button"
                            className="md:hidden -mr-1 p-1.5 rounded-full hover:bg-white/10 transition-colors"
                            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                            aria-expanded={isMobileMenuOpen}
                            aria-controls="mobile-menu"
                            onClick={() => setIsMobileMenuOpen((open) => !open)}
                        >
                            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Phone menu: the bar's links, plus the account ones the hover dropdown has on wide screens */}
            {isMobileMenuOpen && (
                <div
                    id="mobile-menu"
                    className="md:hidden fixed top-28 left-4 right-4 z-50 mx-auto max-w-sm
                               bg-black/60 backdrop-blur-md text-white shadow-2xl border-2 border-white/10
                               rounded-2xl p-2 text-base flex flex-col"
                >
                    <Link href="/docs" className={menuItem} onClick={closeMenu}>Docs</Link>
                    <Link href="/gallery" className={menuItem} onClick={closeMenu}>Gallery</Link>
                    {isAuthenticated && (
                        <>
                            <div className="h-px bg-white/10 my-2 mx-2" />
                            <Link href={`/profile/${profile?.username}`} className={menuItem} onClick={closeMenu}>
                                <User size={18} />
                                Profile
                            </Link>
                            <Link href="/notices" className={`${menuItem} justify-between`} onClick={closeMenu}>
                                <span className="flex items-center gap-3">
                                    <Bell size={18} />
                                    Notices
                                </span>
                                {showNoticesDot && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                            </Link>
                            <Link href="/upload" className={menuItem} onClick={closeMenu}>
                                <Upload size={18} />
                                Upload
                            </Link>
                            {isModerator && (
                                <Link href="/moderation" className={menuItem} onClick={closeMenu}>
                                    <ShieldCheck size={18} />
                                    Moderation
                                </Link>
                            )}
                            <button
                                type="button"
                                onClick={() => { closeMenu(); handleSignOut(); }}
                                className="px-4 py-3 rounded-xl text-left hover:bg-red-500/20 hover:text-red-300 transition-colors duration-200 flex items-center gap-3"
                            >
                                <LogOut size={18} />
                                Sign Out
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Dropdown positioned at same DOM level as navbar */}
            {dropdownOpen && isAuthenticated && !isMobile && (
                <div
                    className="fixed z-50"
                    ref={dropdownRef}
                    onMouseEnter={() => setDropdownOpen(true)}
                    onMouseLeave={() => setDropdownOpen(false)}
                    style={{
                        top: `${dropdownPosition.top + 20}px`,
                        left: `${dropdownPosition.left}px`,
                        transform: 'translateX(-65%)'
                    }}
                >
                    <div className="backdrop-blur-md text-white shadow-2xl border-2 border-white/10 flex flex-col text-sm w-fit rounded-3xl py-4">
                        <Link
                            href={`/profile/${profile?.username}`}
                            className="px-6 py-2 hover:bg-white/10 transition-colors duration-200 rounded-2xl mx-2 font-medium flex items-center gap-3"
                        >
                            <User size={18} />
                            Profile
                        </Link>
                        <Link
                            href="/notices"
                            className="px-6 py-2 hover:bg-white/10 transition-colors duration-200 rounded-2xl mx-2 font-medium flex items-center justify-between gap-3"
                        >
                            <span className="flex items-center gap-3">
                                <Bell size={18} />
                                Notices
                            </span>
                            {showNoticesDot && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                        </Link>
                        <Link
                            href="/upload"
                            className="px-6 py-2 hover:bg-white/10 transition-colors duration-200 rounded-2xl mx-2 font-medium flex items-center gap-3"
                        >
                            <Upload size={18} />
                            Upload
                        </Link>
                        {isModerator && (
                            <Link
                                href="/moderation"
                                className="px-6 py-2 hover:bg-white/10 transition-colors duration-200 rounded-2xl mx-2 font-medium flex items-center gap-3"
                            >
                                <ShieldCheck size={18} />
                                Moderation
                            </Link>
                        )}
                        <button
                            onClick={() => {
                                handleSignOut();
                                setDropdownOpen(false);
                            }}
                            className="px-6 py-2 text-left hover:bg-red-500/20 hover:text-red-300 rounded-2xl mx-2 transition-colors duration-200 font-medium flex items-center gap-3"
                        >
                            <LogOut size={18} />
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default NavBar;
