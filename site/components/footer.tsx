import Link from "next/link";

const GITHUB = 'https://github.com/siphyshu/wallpy';
const link = 'hover:text-white transition-colors';

const Footer = () => {
  return (
    <footer className="text-white/70 text-center pt-12 bg-background">
      <div className="w-full h-[1px] bg-white/10"></div>
      <div className="px-6 py-16 flex flex-col items-center gap-6 text-sm">
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/docs" className={link}>Docs</Link>
          <Link href="/gallery" className={link}>Gallery</Link>
          <a href={GITHUB} className={link} target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href={`${GITHUB}/issues`} className={link} target="_blank" rel="noopener noreferrer">Report a problem</a>
          <a href="mailto:siphyshu@gmail.com" className={link}>siphyshu@gmail.com</a>
          <Link href="/privacy" className={link}>Privacy</Link>
          <Link href="/terms" className={link}>Terms</Link>
        </nav>
        <p>© 2026 Wallpy. All rights reserved.</p>
      </div>
    </footer>
  )
}

export default Footer
