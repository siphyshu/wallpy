"use client"

import Link from 'next/link';
import Image from 'next/image';
import { Alegreya } from 'next/font/google';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { User, Upload, LogOut } from 'lucide-react';

const testing = Alegreya({
    subsets: ['latin'],
});

const NavBar = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [user, setUser] = useState(null); // session user
    const [profile, setProfile] = useState(null); // full user profile
    const [loading, setLoading] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const [isMobile, setIsMobile] = useState(false);
    const avatarRef = useRef();
    const dropdownRef = useRef();
    const supabase = createClient();

    useEffect(() => {
        let mounted = true;

        // Check if mobile
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);

        const loadProfile = async (userId) => {
            const { data: profileData } = await supabase
                .from('users')
                .select('id, username, name, avatar_url')
                .eq('id', userId)
                .single();
            if (mounted) {
                setProfile(profileData);
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
                    setLoading(false);
                }
            }
        );

        // Close dropdown on outside click
        const handleClickOutside = (event) => {
            // Don't close if clicking on a link inside the dropdown
            if (event.target.closest('a') || event.target.tagName === 'A') {
                return;
            }
            
            // Check if click is outside both the avatar and the dropdown area
            const isOutsideAvatar = avatarRef.current && !avatarRef.current.contains(event.target);
            const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(event.target);
            
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
        };
    }, [supabase.auth]);

    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const handleDropdownShow = () => {
        if (avatarRef.current) {
            const rect = avatarRef.current.getBoundingClientRect();
            
            if (isMobile) {
                // On mobile, center the dropdown below the avatar
                const dropdownWidth = 280; // Wider for mobile
                setDropdownPosition({
                    top: rect.bottom + 8,
                    left: rect.left + (rect.width / 2) - (dropdownWidth / 2)
                });
            } else {
                // Desktop positioning
                const dropdownWidth = 200;
                const viewportWidth = window.innerWidth;
                const wouldOverflowRight = rect.right + dropdownWidth > viewportWidth;
                
                setDropdownPosition({
                    top: rect.bottom + 8,
                    left: wouldOverflowRight ? rect.left - dropdownWidth : rect.right
                });
            }
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

    const isAuthenticated = !!user;

    return (
        <div className="fixed w-full z-50">
            {/* Navbar */}
            <nav className={`fixed top-10 left-1/2 -translate-x-1/2 z-50
                            backdrop-blur-md text-white
                            shadow-lg font-serif border-2 border-white/10
                            ${isMobile 
                                ? 'px-4 py-3 rounded-2xl mx-4' 
                                : 'px-12 py-4 rounded-full'
                            } flex items-center justify-center w-auto`}>
                <div className={`flex items-center ${isMobile ? 'gap-4' : 'gap-8'}`}>
                    <Link href="/" className="flex-shrink-0">
                        <Image 
                            src="/waves.png" 
                            alt="Wallpy Logo" 
                            width={48} 
                            height={48} 
                            className="w-8 h-8"
                        />
                    </Link>
                    <div className={`flex items-center ${isMobile ? 'gap-4' : 'gap-8'}`}>
                        {!isMobile && (
                            <>
                                <Link href="/docs" className="hover:underline whitespace-nowrap">Docs</Link>
                                <Link href="/gallery" className="hover:underline whitespace-nowrap">Gallery</Link>
                                <Link href="https://github.com/siphyshu/wallpy" className="hover:underline whitespace-nowrap">Github</Link>
                            </>
                        )}
                        {loading ? (
                            <div className="w-9 h-9 rounded-full bg-white/10 animate-pulse"></div>
                        ) : isAuthenticated ? (
                            <div 
                                className="relative flex items-center gap-2" 
                                ref={avatarRef}
                                onMouseEnter={handleDropdownShow}
                                onMouseLeave={handleDropdownHide}
                            >
                                <Link href={`/profile/${profile?.username}`} className="flex items-center gap-2 focus:outline-none">
                                    <Image
                                        src={profile?.avatar_url && !profile.avatar_url.includes('undefined') ? profile.avatar_url : "/artists/anon.png"}
                                        alt={profile?.name || profile?.username || "User"}
                                        width={36}
                                        height={36}
                                        className="rounded-full border-2 border-white/20 object-cover w-9 h-9 bg-white/10 hover:border-white/40 transition-colors duration-200"
                                    />
                                </Link>
                            </div>
                        ) : (
                            <Link href="/auth/login" className="hover:underline whitespace-nowrap">Sign In</Link>
                        )}
                    </div>
                </div>
            </nav>
            
            {/* Dropdown positioned at same DOM level as navbar */}
            {dropdownOpen && isAuthenticated && (
                <div 
                    className="fixed z-50"
                    ref={dropdownRef}
                    onMouseEnter={() => !isMobile && setDropdownOpen(true)}
                    onMouseLeave={() => !isMobile && setDropdownOpen(false)}
                    style={{
                        top: `${dropdownPosition.top + 20}px`,
                        left: `${dropdownPosition.left}px`,
                        transform: isMobile ? 'none' : 'translateX(-65%)'
                    }}
                >
                    <div className={`backdrop-blur-md text-white shadow-2xl border-2 border-white/10 flex flex-col font-serif ${
                        isMobile 
                            ? 'w-72 rounded-2xl py-3' 
                            : 'w-fit rounded-3xl py-4'
                    }`}>
                        <Link 
                            href={`/profile/${profile?.username}`} 
                            className={`${isMobile ? 'px-4 py-3' : 'px-6 py-2'} hover:bg-white/10 transition-colors duration-200 rounded-2xl mx-2 font-medium flex items-center gap-3`}
                            onClick={() => isMobile && setDropdownOpen(false)}
                        >
                            <User size={18} />
                            Profile
                        </Link>
                        <Link 
                            href="/upload" 
                            className={`${isMobile ? 'px-4 py-3' : 'px-6 py-2'} hover:bg-white/10 transition-colors duration-200 rounded-2xl mx-2 font-medium flex items-center gap-3`}
                            onClick={() => isMobile && setDropdownOpen(false)}
                        >
                            <Upload size={18} />
                            Upload
                        </Link>
                        <button
                            onClick={() => {
                                handleSignOut();
                                setDropdownOpen(false);
                            }}
                            className={`${isMobile ? 'px-4 py-3' : 'px-6 py-2'} text-left hover:bg-red-500/20 hover:text-red-300 rounded-2xl mx-2 transition-colors duration-200 font-medium flex items-center gap-3`}
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