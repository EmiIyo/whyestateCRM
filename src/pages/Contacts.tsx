import { motion } from 'framer-motion';
import { UserCircle, Plus, Search, Phone, Mail, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { sampleContacts } from '@/data/index';
import { staggerContainer, staggerItem } from '@/lib/motion';

const contactTypeColors: Record<string, string> = {
  tenant: 'bg-blue-100 text-blue-700',
  landlord: 'bg-emerald-100 text-emerald-700',
  buyer: 'bg-purple-100 text-purple-700',
  seller: 'bg-orange-100 text-orange-700',
};

export default function Contacts() {
  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-5">
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Contacts</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Tenants, landlords, buyers & sellers</p>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus size={15} className="mr-1.5" /> Add Contact
        </Button>
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground flex-1 max-w-xs">
          <Search size={14} /> <span>Search contacts...</span>
        </div>
        {(['tenant', 'landlord', 'buyer', 'seller'] as const).map((type) => (
          <button key={type} className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize ${contactTypeColors[type]}`}>
            {type}
          </button>
        ))}
      </motion.div>

      <motion.div variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sampleContacts.map((contact) => (
          <motion.div key={contact.id} variants={staggerItem}>
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-sm">{contact.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-foreground text-sm truncate">{contact.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${contactTypeColors[contact.type]}`}>
                        {contact.type}
                      </span>
                    </div>
                    {contact.company && <p className="text-xs text-muted-foreground mb-2">{contact.company}</p>}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone size={11} /> {contact.phone}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail size={11} /> {contact.email}
                      </div>
                      {contact.icNumber && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Tag size={11} /> IC: {contact.icNumber}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-border">
                      <span className="text-xs text-muted-foreground">{contact.relatedListings.length} listing(s)</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="text-xs text-muted-foreground font-mono">{contact.id}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Coming soon card */}
        <motion.div variants={staggerItem}>
          <Card className="border border-dashed border-border shadow-none bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer">
            <CardContent className="p-4 flex flex-col items-center justify-center h-full min-h-36 text-center">
              <UserCircle size={28} className="text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Add New Contact</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Full contacts module coming soon</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
