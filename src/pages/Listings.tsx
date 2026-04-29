import { motion } from 'framer-motion';
import { Building2, Plus, Search, Filter, Bed, Bath, Maximize2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { sampleListings } from '@/data/index';
import { PROPERTY_STATUS_COLORS, formatCurrency } from '@/lib/index';
import { staggerContainer, staggerItem } from '@/lib/motion';

export default function Listings() {
  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-5">
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Listings</h2>
          <p className="text-sm text-muted-foreground mt-0.5">47 active properties in your portfolio</p>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus size={15} className="mr-1.5" /> Add Listing
        </Button>
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground flex-1 max-w-xs">
          <Search size={14} /> <span>Search properties...</span>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"><Filter size={13} /> Filter</Button>
      </motion.div>

      <motion.div variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sampleListings.map((listing) => (
          <motion.div key={listing.id} variants={staggerItem}>
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
              <div className="h-40 bg-gradient-to-br from-primary/10 to-primary/5 rounded-t-lg flex items-center justify-center">
                <Building2 size={40} className="text-primary/30" />
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{listing.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{listing.address}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 ${PROPERTY_STATUS_COLORS[listing.status]}`}>
                    {listing.status}
                  </span>
                </div>
                <p className="text-lg font-bold text-primary font-mono mb-3">{formatCurrency(listing.price)}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {listing.bedrooms > 0 && (
                    <span className="flex items-center gap-1"><Bed size={12} /> {listing.bedrooms} bed</span>
                  )}
                  <span className="flex items-center gap-1"><Bath size={12} /> {listing.bathrooms} bath</span>
                  <span className="flex items-center gap-1"><Maximize2 size={12} /> {listing.sqft.toLocaleString()} sqft</span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <Badge variant="outline" className="text-xs capitalize">{listing.type}</Badge>
                  <span className="text-xs text-muted-foreground font-mono">{listing.id}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center justify-center py-4">
        <Badge variant="outline" className="text-muted-foreground text-xs">
          🏢 Full listings management with filters — Coming in next module
        </Badge>
      </motion.div>
    </motion.div>
  );
}
