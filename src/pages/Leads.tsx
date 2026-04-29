import { motion } from 'framer-motion';
import { Users, Plus, Search, Filter, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { recentLeads } from '@/data/index';
import { LEAD_STATUS_COLORS, LEAD_STATUS_LABELS, PRIORITY_COLORS, formatCurrency } from '@/lib/index';
import { staggerContainer, staggerItem } from '@/lib/motion';

export default function Leads() {
  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-5">
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Leads</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and track your property leads pipeline</p>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus size={15} className="mr-1.5" /> Add Lead
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div variants={staggerItem} className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground">
          <Search size={14} /> <span>Search leads...</span>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"><Filter size={13} /> Filter</Button>
        {(['new', 'contacted', 'viewing', 'negotiation', 'closed'] as const).map((s) => (
          <button key={s} className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${LEAD_STATUS_COLORS[s]} border-transparent`}>
            {LEAD_STATUS_LABELS[s]}
          </button>
        ))}
      </motion.div>

      {/* Leads Table */}
      <motion.div variants={staggerItem}>
        <Card className="border border-border shadow-sm">
          <CardContent className="px-0 pb-0 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lead</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Interest</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Budget</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Contact</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-muted/20 transition-colors cursor-pointer">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-semibold text-xs">{lead.name[0]}</span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{lead.name}</p>
                            <p className="text-xs text-muted-foreground">{lead.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{lead.propertyInterest}</td>
                      <td className="px-4 py-3.5 font-mono text-foreground">{formatCurrency(lead.budget)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[lead.priority]}`}>{lead.priority}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAD_STATUS_COLORS[lead.status]}`}>{LEAD_STATUS_LABELS[lead.status]}</span>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">{lead.lastContact}</td>
                      <td className="px-4 py-3.5">
                        <button className="text-muted-foreground hover:text-primary transition-colors"><ArrowUpRight size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Coming soon badge */}
      <motion.div variants={staggerItem} className="flex items-center justify-center py-4">
        <Badge variant="outline" className="text-muted-foreground text-xs">
          📋 Kanban Pipeline View — Coming in next module
        </Badge>
      </motion.div>
    </motion.div>
  );
}
