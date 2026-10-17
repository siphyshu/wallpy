import { LoginForm } from '@/components/auth/login-form';
import Image from 'next/image';
import Footer from '@/components/footer';
import { Suspense } from 'react';

export const metadata = { title: 'Sign in | Wallpy' };

export default function LoginPage() {
  return (
    <div className="min-h-screen overflow-x-hidden text-white bg-background/80">
      <div className="min-h-screen flex flex-col md:flex-row items-start justify-center gap-12 pt-48">
        {/* Left: Login Form */}
        <div className="flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* LoginForm reads ?redirect via useSearchParams, which needs a Suspense boundary to prerender */}
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
        {/* Right: Visual Collage */}
        <div className="hidden md:flex flex-col items-center justify-center">
          <div className="relative w-[360px] h-[360px]">
            <div className="absolute top-[10%] left-[10%] w-44 h-28 rotate-[-10deg] shadow-xl z-20">
              <Image src="/wallpapers/zelda-wind-waker.jpg" alt="Zelda Wind Waker" fill className="object-cover rounded-xl border-4 border-white/20 aspect-video" />
            </div>
            <div className="absolute top-[50%] left-[55%] w-52 h-36 rotate-[12deg] shadow-xl z-30">
              <Image src="/wallpapers/deku-tree.jpg" alt="Deku Tree" fill className="object-cover rounded-xl border-4 border-white/20 aspect-video" />
            </div>
            <div className="absolute top-[70%] left-[5%] w-40 h-24 rotate-[-6deg] shadow-xl z-10">
              <Image src="/wallpapers/tokyo-street.jpg" alt="Tokyo Street" fill className="object-cover rounded-xl border-4 border-white/20 aspect-video" />
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
} 