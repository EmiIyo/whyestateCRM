import { motion } from 'framer-motion';
import { Settings, User, Bell, Shield, Palette, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { staggerContainer, staggerItem } from '@/lib/motion';

export default function SettingsPage() {
  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-5 max-w-2xl">
      <motion.div variants={staggerItem}>
        <h2 className="text-xl font-bold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your CRM preferences and account</p>
      </motion.div>

      {[
        { icon: User, title: 'Profile', desc: 'Name, IC, agency license, contact info', badge: null },
        { icon: Bell, title: 'Notifications', desc: 'Renewal alerts, lead reminders, task nudges', badge: '3 active' },
        { icon: Palette, title: 'Appearance', desc: 'Theme, language, date & currency format', badge: null },
        { icon: Shield, title: 'Security', desc: 'Password, two-factor authentication', badge: null },
        { icon: Database, title: 'Data & Export', desc: 'Export leads, TAs, and contacts as CSV/XLSX', badge: null },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <motion.div key={item.title} variants={staggerItem}>
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground text-sm">{item.title}</p>
                      {item.badge && (
                        <Badge variant="outline" className="text-xs">{item.badge}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors text-lg">›</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      <motion.div variants={staggerItem} className="flex items-center justify-center py-4">
        <Badge variant="outline" className="text-muted-foreground text-xs">
          ⚙️ Full settings & team management — Coming soon
        </Badge>
      </motion.div>
    </motion.div>
  );
}
