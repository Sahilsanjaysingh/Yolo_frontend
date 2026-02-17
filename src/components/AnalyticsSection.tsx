import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Activity, Shield, Zap } from 'lucide-react';

function lastNMonths(n: number) {
  const months: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: d.toLocaleString(undefined, { month: 'short' }) });
  }
  return months;
}

export default function AnalyticsSection() {
  const [images, setImages] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';
    const load = async () => {
      setLoading(true);
      try {
        const [dRes, iRes] = await Promise.all([fetch(`${apiBase}/api/dashboard`), fetch(`${apiBase}/api/images`)]);
        const dJson = dRes.ok ? await dRes.json() : null;
        const iJson = iRes.ok ? await iRes.json() : [];
        if (!mounted) return;
        setDashboard(dJson);
        setImages(Array.isArray(iJson) ? iJson : []);
      } catch (e) {
        console.error('analytics load error', e);
        if (!mounted) return;
        setDashboard(null);
        setImages([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false };
  }, []);

  // Listen for image-created / image-updated events so analytics update in real-time
  useEffect(() => {
    const onCreated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setImages(prev => [detail, ...prev]);
    };
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setImages(prev => prev.map(img => (img._id === detail._id ? detail : img)));
    };
    window.addEventListener('image-created', onCreated as EventListener);
    window.addEventListener('image-updated', onUpdated as EventListener);
    return () => {
      window.removeEventListener('image-created', onCreated as EventListener);
      window.removeEventListener('image-updated', onUpdated as EventListener);
    };
  }, []);

  // compute total detections
  const totalDetections = useMemo(() => images.reduce((s, img) => s + ((img.detections && img.detections.length) || 0), 0), [images]);

  const avgAccuracy = useMemo(() => {
    // produce a percentage number like 99.2
    let raw = 0;
    if (dashboard && typeof dashboard.avgConfidence === 'number') raw = dashboard.avgConfidence;
    else {
      const vals = images.map(i => (typeof i.avgConfidence === 'number' ? i.avgConfidence : 0)).filter(v => v > 0);
      if (vals.length) raw = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return Math.round((raw * 1000)) / 10; // e.g. 99.2
  }, [dashboard, images]);

  const safetyScore = useMemo(() => Math.round(avgAccuracy * 10) / 10, [avgAccuracy]);

  // monthly charts (last 6 months)
  const months = useMemo(() => lastNMonths(6), []);
  const detectionData = useMemo(() => {
    const map: Record<string, { detections: number; accuracySum: number; count: number }> = {};
    months.forEach(m => map[m.key] = { detections: 0, accuracySum: 0, count: 0 });
    images.forEach(img => {
      const d = img.createdAt ? new Date(img.createdAt) : null;
      if (!d) return;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!map[key]) return;
      map[key].detections += (img.detections || []).length;
      if (typeof img.avgConfidence === 'number') { map[key].accuracySum += img.avgConfidence; map[key].count += 1 }
    });
    return months.map(m => ({ month: m.label, detections: map[m.key].detections, accuracy: map[m.key].count ? Math.round((map[m.key].accuracySum / map[m.key].count) * 100) / 100 : 0 }));
  }, [images, months]);

  // equipment distribution
  const equipmentDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    images.forEach(img => (img.detections || []).forEach((d: any) => { counts[d.object] = (counts[d.object] || 0) + 1 }));
    const colors = ['#6366F1','#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444','#F472B6'];
    return Object.keys(counts).map((k, i) => ({ name: k, value: counts[k], color: colors[i % colors.length] }));
  }, [images]);

  // 24-hour activity (hour bins)
  const realTimeData = useMemo(() => {
    const hours = Array.from({ length: 24 }).map((_, i) => ({ time: `${i.toString().padStart(2,'0')}:00`, detections: 0 }));
    images.forEach(img => (img.detections || []).forEach((d: any) => {
      const t = d.detectedAt ? new Date(d.detectedAt) : (img.createdAt ? new Date(img.createdAt) : null);
      if (!t) return;
      const h = t.getHours();
      hours[h].detections += 1;
    }));
    return hours;
  }, [images]);

  const placeholder = '—';
  const responseTimeValue = (dashboard && typeof dashboard.responseTime === 'number') ? `${dashboard.responseTime}ms` : placeholder;

  const stats = [
    { icon: Activity, label: 'Total Detections', value: totalDetections.toLocaleString(), trend: '', color: 'primary' },
    { icon: TrendingUp, label: 'Avg Accuracy', value: `${avgAccuracy}%`, trend: '', color: 'secondary' },
    { icon: Shield, label: 'Safety Score', value: `${safetyScore}%`, trend: '', color: 'accent' },
    { icon: Zap, label: 'Response Time', value: responseTimeValue, trend: '', color: 'primary' },
  ];

  return (
    <section className="relative min-h-screen py-20 px-6 bg-gradient-to-br from-background via-background to-secondary/5">
      <div className="max-w-7xl mx-auto space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4"
        >
          <h2 className="text-4xl md:text-5xl font-bold">
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Real-Time Analytics
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Monitor detection performance, accuracy trends, and equipment distribution in real-time
          </p>
        </motion.div>

        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}>
          {stats.map((stat, i) => (
            <motion.div key={i} whileHover={{ scale: 1.05, y: -5 }} className="relative bg-card border border-border rounded-2xl p-6 overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <stat.icon className={`w-8 h-8 text-${stat.color}`} />
                  <span className="text-sm text-green-500 font-semibold">{stat.trend}</span>
                </div>
                <div className="space-y-1">
                  <div className={`text-3xl font-bold font-mono ${stat.value === placeholder ? 'text-muted-foreground opacity-80' : ''}`}>{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.3 }} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-xl font-semibold">Monthly Detection Volume</h3>
              <p className="text-sm text-muted-foreground">Tracking detection trends over time</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={detectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="detections" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.3 }} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-xl font-semibold">Accuracy Performance</h3>
              <p className="text-sm text-muted-foreground">Model accuracy over time</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={detectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[98, 100]} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--secondary))" strokeWidth={3} dot={{ fill: 'hsl(var(--secondary))', r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.4 }} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-xl font-semibold">Equipment Distribution</h3>
              <p className="text-sm text-muted-foreground">Detection breakdown by equipment type</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={equipmentDistribution} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={(entry) => entry.name}>
                  {equipmentDistribution.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.4 }} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-xl font-semibold">24-Hour Activity</h3>
              <p className="text-sm text-muted-foreground">Real-time detection activity</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={realTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="detections" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
