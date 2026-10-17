import Image from "next/image"

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 text-center">
      {/* Grid background */}
      <div className="inset-0 z-0">
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'url("/grid-large.svg")',
            backgroundRepeat: 'repeat-x',
            backgroundSize: 'auto 100%',
            opacity: 0.1,
            // mask: 'linear-gradient(0deg,rgba(0,0,0,0) 4%,rgba(0,0,0,0.73) 24%,rgba(0,0,0,0.7) 55%,rgba(0,0,0,0.01643) 100%) add'
            mask: 'radial-gradient(70% 46% at 50% 50%, rgba(0,0,0,0.73) 0%, rgba(0,0,0,0.01643) 100%)'
          }}
        />
      </div>
      
      {/* Local gradient overlay in hero */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/0 from-20% via-55% via-black/40 to-95% to-black/80" />

      <div className="relative z-10 max-w-3xl">
        {/* <div className="absolute top-[-40] left-1/2 -translate-x-1/2 inline-block px-4 py-2 text-xs font-semibold rounded-full bg-black/40 backdrop-blur-md border border-white/20 mb-6">
           ✨ Wallpy v2.25.0 
        </div> */}
        <h1 className="text-4xl md:text-7xl font-light leading-tight">
          <span className="italic font-serif">Dynamic Wallpapers</span><br />
          <span className="font-bold">for your desktop.</span>
        </h1>
        <p className="mt-4 text-sm md:text-base text-white/80">
          Use dynamic wallpapers on Windows, Linux, and MacOS with a CLI
        </p>
        <div className="mt-6 flex justify-center gap-4 flex-wrap">
          <a
            href="/gallery"
            className="px-6 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-200"
          >
            Browse Gallery
          </a>
          <a
            href="#install"
            className="px-6 py-2 rounded-full border border-white text-white text-sm hover:bg-white/10"
          >
            Install Wallpy →
          </a>
        </div>
      </div>
    </section>


  )
}

export default HeroSection