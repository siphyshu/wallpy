import Image from "next/image";
import Link from "next/link";

export default function Gallery() {
    return (
      <section id="gallery" className="relative py-12 px-6 bg-black/80 text-white h-full">
        <div className="max-w-5xl mx-auto text-center mb-40">
          <h2 className="text-3xl md:text-5xl font-serif mb-6">Wallpy Gallery</h2>
          <p className="text-white/80 mb-12">
            Choose from 100+ wallpacks created by the community, and install them with a single command.
          </p>
  
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {/* Example Gallery Items — replace with dynamic map if needed */}
            {[
              { name: "Zelda Wind Waker", url: "https://wallpy.siphyshu.me/packs/zelda-wind-waker", preview: "/wallpapers/zelda-wind-waker.jpg", author: "Matt Vince", author_url: "https://mattvince.com", author_profile: "/artists/mattvince.png" },
              { name: "Ocean Hours", url: "https://wallpy.siphyshu.me/packs/ocean-hours", preview: "/wallpapers/ocean-hours.png", author: "pastelmosaic", author_url: "https://youtube.com/watch?v=dQw4w9WgXcQ", author_profile: "/artists/mosaic.png" },
              { name: "Tokyo Street", url: "https://wallpy.siphyshu.me/packs/tokyo-street", preview: "/wallpapers/tokyo-street.jpg", author: "ArseniXC", author_url: "https://www.deviantart.com/arsenixc", author_profile: "/artists/arsenixc.jpg" },
              { name: "Mystery Shack Porch", url: "https://wallpy.siphyshu.me/packs/mystery-shack-porch", preview: "/wallpapers/mystery-shack-porch.jpg", author: "Anonymous", author_url: "https://youtube.com/watch?v=dQw4w9WgXcQ", author_profile: "/artists/anon.png" },
              { name: "Greasy Diner", url: "https://wallpy.siphyshu.me/packs/greasy-diner", preview: "/wallpapers/greasy-diner.jpg", author: "Anonymous", author_url: "https://youtube.com/watch?v=dQw4w9WgXcQ", author_profile: "/artists/anon.png" },
              { name: "Deku Tree", url: "https://wallpy.siphyshu.me/packs/deku-tree", preview: "/wallpapers/deku-tree.jpg", author: "Matt Vince", author_url: "https://mattvince.com", author_profile: "/artists/mattvince.png" },

            ].map((pack) => (
              <div key={pack.url} className="group">
                <div className="bg-white/5 p-4 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-300 hover:shadow-lg hover:shadow-white/5 hover:-translate-y-1">
                  <Link href={pack.url} className="block">
                    <div className="relative w-full h-48 mb-4 overflow-hidden rounded-lg">
                      <Image 
                        src={pack.preview} 
                        alt={pack.name} 
                        fill 
                        className="object-cover transition-transform duration-300 group-hover:scale-105" 
                      />
                      
                    </div>
                  </Link>
                  <div className="flex flex-col gap-2">
                    <Link href={pack.url} className="block">
                      <h3 className="font-semibold text-lg text-left truncate group-hover:text-white/90 transition-colors duration-200">{pack.name}</h3>
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-white/80">
                      <div className="relative w-5 h-5 rounded-full overflow-hidden border border-white/20">
                        <Image 
                          src={pack.author_profile} 
                          alt={pack.author} 
                          fill 
                          className="object-cover" 
                        />
                      </div>
                      <a 
                        href={pack.author_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white transition-colors duration-200"
                      >
                        {pack.author}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
  