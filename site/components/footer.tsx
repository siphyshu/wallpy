import Link from "next/link";

const Footer = ( {isHome = false} ) => {
  return (
    <>
    {isHome && (
    <footer className="text-white/70 text-center pt-32 bg-black/80">
      <div className="w-full h-[1px] bg-white/10"></div>
        <p className="text-sm p-16">© 2026 Wallpy. All rights reserved.</p>
    </footer>
    )}
    {!isHome && (
      <footer className="text-white/70 text-center pt-12 bg-background">
        <div className="w-full h-[1px] bg-white/10"></div>
        <p className="text-sm p-16">© 2026 Wallpy. All rights reserved.</p>
      </footer>
    )}
    </>
  )
}

export default Footer