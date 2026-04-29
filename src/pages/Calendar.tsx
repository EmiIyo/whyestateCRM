import { motion } from 'framer-motion';
import { CalendarDays, Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { staggerContainer, staggerItem } from '@/lib/motion';

const upcomingTasks = [
  { id: 1, title: 'Property viewing — Ahmad Farid', date: '2026-04-24', time: '10:00 AM', type: 'viewing', status: 'pending' },
  { id: 2, title: 'Follow up — Priya Nair', date: '2026-04-24', time: '2:30 PM', type: 'follow-up', status: 'pending' },
  { id: 3, title: 'TA renewal reminder — Mohd Azlan', date: '2026-04-25', time: '9:00 AM', type: 'renewal', status: 'urgent' },
  { id: 4, title: 'Commission collection — TA-2026-002', date: '2026-04-26', time: '11:00 AM', type: 'payment', status: 'pending' },
  { id: 5, title: 'Cold call batch — 15 new leads', date: '2026-04-28', time: '10:00 AM', type: 'call', status: 'pending' },
];

const typeColors: Record<string, string> = {
  viewing: 'bg-purple-100 text-purple-700',
  'follow-up': 'bg-blue-100 text-blue-700',
  renewal: 'bg-amber-100 text-amber-700',
  payment: 'bg-emerald-100 text-emerald-700',
  call: 'bg-gray-100 text-gray-700',
};

export default function CalendarPage() {
  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-5">
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Calendar & Tasks</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Viewings, follow-ups, and renewal reminders</p>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus size={15} className="mr-1.5" /> Add Task
        </Button>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Task List */}
        <div className="lg:col-span-2">
          <Card className="border border-border shadow-sm">
            <CardHeader className="pt-5 pb-3 px-5">
              <CardTitle className="text-sm font-semibold text-foreground">Upcoming Tasks</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="divide-y divide-border">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === 'urgent' ? 'bg-destructive' : 'bg-primary'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock size={11} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{task.date} at {task.time}</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${typeColors[task.type]}`}>
                      {task.type}
                    </span>
                    {task.status === 'urgent' && (
                      <AlertCircle size={15} className="text-destructive flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mini calendar placeholder */}
        <div>
          <Card className="border border-border shadow-sm">
            <CardHeader className="pt-5 pb-3 px-5">
              <CardTitle className="text-sm font-semibold text-foreground">April 2026</CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <div className="grid grid-cols-7 gap-1 text-center">
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} className="text-xs text-muted-foreground font-medium py-1">{d}</div>
                ))}
                {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                  <button key={d} className={`text-xs py-1.5 rounded-md transition-colors
                    ${d === 23 ? 'bg-primary text-primary-foreground font-bold' : ''}
                    ${[24,25,26,28].includes(d) ? 'bg-primary/10 text-primary font-medium' : ''}
                    ${d !== 23 && ![24,25,26,28].includes(d) ? 'text-foreground hover:bg-muted' : ''}
                  `}>
                    {d}
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Today (Apr 23)
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-primary/30 inline-block" /> Has tasks
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center justify-center py-4">
        <Badge variant="outline" className="text-muted-foreground text-xs">
          📅 Full calendar view with drag & drop — Coming in next module
        </Badge>
      </motion.div>
    </motion.div>
  );
}
