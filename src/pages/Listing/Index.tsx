import { Building2, Plus } from 'lucide-react';

export default function ListingPage() {
  return (
    <div className="flex-1 overflow-auto" style={{ background: '#F5F7FA' }}>
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1A202C' }}>Listing</h1>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Manage your property listings</p>
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: '#1EC9C4' }}
          >
            <Plus size={13} /> New Listing
          </button>
        </div>

        <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: '#F1F5F9' }}>
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ background: '#F0FBFA' }}>
            <Building2 size={26} style={{ color: '#0F766E' }} />
          </div>
          <h3 className="text-sm font-bold" style={{ color: '#1A202C' }}>No listings yet</h3>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Create your first listing to get started.</p>
        </div>
      </div>
    </div>
  );
}
