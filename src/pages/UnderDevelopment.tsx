import { Wrench } from 'lucide-react';

export default function UnderDevelopment({ name }: { name: string }) {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
      <div className="text-center px-6">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
          style={{ background: '#FEF3C7' }}>
          <Wrench size={28} style={{ color: '#D97706' }} strokeWidth={2.2} />
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#1A202C' }}>{name}</h2>
        <p className="text-sm" style={{ color: '#9CA3AF' }}>Coming soon — module in development.</p>
      </div>
    </div>
  );
}
