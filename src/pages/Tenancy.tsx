import { motion } from 'framer-motion';
import { FileText, Plus, Search, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { recentTenancies } from '@/data/index';
import { TENANCY_STATUS_COLORS, formatCurrency } from '@/lib/index';
import { staggerContainer, staggerItem } from '@/lib/motion';

export default function Tenancy() {
  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-5">
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Tenancy Agreements</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Draft, manage, and track all tenancy agreements</p>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus size={15} className="mr-1.5" /> New TA
        </Button>
      </motion.div>

      {/* Quick stats */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active TAs', value: '24', color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Expiring (30d)', value: '3', color: 'text-amber-600 bg-amber-50' },
          { label: 'Expired', value: '8', color: 'text-red-600 bg-red-50' },
          { label: 'Draft', value: '5', color: 'text-muted-foreground bg-muted' },
        ].map((s) => (
          <Card key={s.label} className="border border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold font-mono ${s.color.split(' ')[0]}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground flex-1 max-w-xs">
          <Search size={14} /> <span>Search TAs...</span>
        </div>
      </motion.div>

      {/* TA Table */}
      <motion.div variants={staggerItem}>
        <Card className="border border-border shadow-sm">
          <CardContent className="px-0 pb-0 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">TA Number</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tenant</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Property</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rental</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Period</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentTenancies.map((ta) => (
                    <tr key={ta.id} className="hover:bg-muted/20 transition-colors cursor-pointer">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-foreground font-medium">{ta.taNumber}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="font-medium text-foreground text-sm">{ta.tenantName}</p>
                          <p className="text-xs text-muted-foreground">Landlord: {ta.landlordName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs max-w-[200px] truncate">{ta.propertyAddress}</td>
                      <td className="px-4 py-3.5">
                        <p className="font-mono text-foreground font-medium text-sm">{formatCurrency(ta.monthlyRental)}/mo</p>
                        <p className="text-xs text-muted-foreground">Dep: {formatCurrency(ta.securityDeposit + ta.utilityDeposit)}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar size={11} />
                          <span>{ta.startDate} → {ta.endDate}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TENANCY_STATUS_COLORS[ta.status]}`}>
                          {ta.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary">Edit</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center justify-center py-4">
        <Badge variant="outline" className="text-muted-foreground text-xs">
          📄 TA Drafting Tool with DOCX export — Coming in next module
        </Badge>
      </motion.div>
    </motion.div>
  );
}
