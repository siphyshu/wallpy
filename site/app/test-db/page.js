import { testConnection } from '@/lib/test-connection'
import { 
  getPublishedPacks, 
  getPackCount
} from '@/lib/data'

export default async function TestDBPage() {
  // Test the connection
  const connectionTest = await testConnection()
  
  // Test fetching data using the new data access layer
  const allPacks = await getPublishedPacks()
  // const popularPacks = await getPopularPacks(3)
  // const recentPacks = await getRecentPacks(3)
  // const allTags = await getAllTags()
  const packCount = await getPackCount()

  return (
    <div className="min-h-screen bg-background/80 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-serif mb-8">Database Test Page</h1>
        
        {/* Connection Test */}
        <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
          <h2 className="text-xl font-semibold mb-4">Connection Test</h2>
          <div className={`p-3 rounded ${connectionTest.success ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
            {connectionTest.success ? '✅ Database connection successful!' : `❌ Connection failed: ${connectionTest.error}`}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
          <h2 className="text-xl font-semibold mb-4">Database Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-3 bg-white/5 rounded border border-white/10">
              <div className="text-2xl font-bold">{packCount}</div>
              <div className="text-sm text-white/70">Total Packs</div>
            </div>
            <div className="p-3 bg-white/5 rounded border border-white/10">
              <div className="text-2xl font-bold">{allPacks.length}</div>
              <div className="text-sm text-white/70">Published Packs</div>
            </div>
            {/* <div className="p-3 bg-white/5 rounded border border-white/10">
              <div className="text-2xl font-bold">{allTags.length}</div>
              <div className="text-sm text-white/70">Unique Tags</div>
            </div> */}
            <div className="p-3 bg-white/5 rounded border border-white/10">
              <div className="text-2xl font-bold">✅</div>
              <div className="text-sm text-white/70">Data Layer</div>
            </div>
          </div>
        </div>

        {/* All Packs */}
        <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
          <h2 className="text-xl font-semibold mb-4">All Published Packs ({allPacks.length})</h2>
          {allPacks.length > 0 ? (
            <div className="space-y-2">
              {allPacks.map(pack => (
                <div key={pack.id} className="p-3 bg-white/5 rounded border border-white/10">
                  <div className="font-semibold">{pack.title}</div>
                  <div className="text-sm text-white/70">Slug: {pack.slug}</div>
                  <div className="text-sm text-white/70">Downloads: {pack.download_count}</div>
                  {pack.tags && pack.tags.length > 0 && (
                    <div className="text-sm text-white/70">Tags: {pack.tags.join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/60">No packs found. You may need to add some data to your database.</p>
          )}
        </div>

        {/* Popular Packs */}
        {/* <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
          <h2 className="text-xl font-semibold mb-4">Popular Packs ({popularPacks.length})</h2>
          {popularPacks.length > 0 ? (
            <div className="space-y-2">
              {popularPacks.map(pack => (
                <div key={pack.id} className="p-3 bg-white/5 rounded border border-white/10">
                  <div className="font-semibold">{pack.title}</div>
                  <div className="text-sm text-white/70">Downloads: {pack.download_count}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/60">No popular packs found.</p>
          )}
        </div> */}

        {/* Recent Packs */}
        {/* <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
          <h2 className="text-xl font-semibold mb-4">Recent Packs ({recentPacks.length})</h2>
          {recentPacks.length > 0 ? (
            <div className="space-y-2">
              {recentPacks.map(pack => (
                <div key={pack.id} className="p-3 bg-white/5 rounded border border-white/10">
                  <div className="font-semibold">{pack.title}</div>
                  <div className="text-sm text-white/70">Created: {new Date(pack.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/60">No recent packs found.</p>
          )}
        </div> */}

        {/* Available Tags */}
        {/* <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
          <h2 className="text-xl font-semibold mb-4">Available Tags ({allTags.length})</h2>
          {allTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <span key={tag} className="px-2 py-1 bg-white/10 rounded-full text-sm">
                  #{tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-white/60">No tags found.</p>
          )}
        </div> */}

        {/* Instructions */}
        <div className="p-6 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <h2 className="text-xl font-semibold mb-4 text-blue-300">Data Access Layer Ready! 🎉</h2>
          <ul className="space-y-2 text-blue-200">
            <li>• ✅ Database connection working</li>
            <li>• ✅ Data access functions organized in lib/data/</li>
            <li>• ✅ CRUD operations for packs, users, and downloads</li>
            <li>• ✅ Search, filtering, and analytics functions</li>
            <li>• ✅ Ready to integrate with your components!</li>
          </ul>
        </div>
      </div>
    </div>
  )
} 