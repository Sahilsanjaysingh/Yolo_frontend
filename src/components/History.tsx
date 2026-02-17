import * as React from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import useNow from '../hooks/use-now';

export default function History() {
  type Detection = { object: string; confidence: number; bbox?: { x: number; y: number; width: number; height: number }, detectedAt?: string | Date, detector?: string };
  type ImageDoc = {
    _id: string;
    filename: string;
    originalName?: string;
    mimeType?: string;
    size?: number;
    url?: string;
    createdAt?: string;
    detections?: Detection[];
    avgConfidence?: number;
    metadata?: Record<string, any>;
  };

  const [items, setItems] = React.useState<ImageDoc[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchImages = React.useCallback(async () => {
    setLoading(true);
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';
      const res = await fetch(`${apiBase}/api/images`);
      if (!res.ok) throw new Error('Failed to load images');
      const json = await res.json();
      // filter out exported CSVs and other non-image artifacts (e.g., detection_history CSV files)
      if (Array.isArray(json)) {
        const filtered = json.filter((it: ImageDoc) => {
          const mime = (it.mimeType || '').toLowerCase();
          const fname = (it.filename || '').toLowerCase();
          const oname = (it.originalName || '').toLowerCase();
          // Exclude any records that look like CSV exports by mime or filename/originalName containing .csv
          if (mime.includes('csv')) return false;
          if (fname.includes('.csv') || oname.includes('.csv')) return false;
          if (fname.startsWith('detection_history') || oname.startsWith('detection_history')) return false;
          return true;
        });
        setItems(filtered);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error('fetchImages error', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // tick so timestamps update (toLocaleString / relative UI) without refetching
  useNow(30000);

  React.useEffect(() => {
    void fetchImages();
  }, [fetchImages]);

  // items are already filtered server-side / above to exclude CSV exports

  React.useEffect(() => {
    const onCreated = (e: Event) => {
      const detail = (e as CustomEvent).detail as ImageDoc;
      // ignore CSV uploads created by client-side export actions
      const mime = (detail.mimeType || '').toLowerCase();
      const fname = (detail.filename || '').toLowerCase();
      if (mime.includes('csv') || fname.endsWith('.csv') || fname.startsWith('detection_history')) return;
      setItems(prev => [detail, ...prev]);
    };
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as ImageDoc;
      setItems(prev => prev.map(it => (it._id === detail._id ? detail : it)));
    };
  window.addEventListener('image-created', onCreated as EventListener);
    window.addEventListener('image-updated', onUpdated as EventListener);
    return () => {
      window.removeEventListener('image-created', onCreated as EventListener);
      window.removeEventListener('image-updated', onUpdated as EventListener);
    };
  }, []);

  return (
    <section className="min-h-screen py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold font-serif mb-4">Detection <span className="text-primary">History</span></h2>
            <p className="text-lg text-muted-foreground">Browse past detection scans and results</p>
          </div>
          <div className="flex gap-3 items-center">
            <Button className="bg-primary hover:bg-primary/90 gap-2" onClick={() => {
              // generate CSV from items
              const rows: string[] = [];
              const header = ['id','filename','createdAt','mimeType','size','objectsCount','avgConfidence','detectionsJSON'];
              rows.push(header.join(','));
              items.forEach(it => {
                const detections = it.detections || [];
                const row = [
                  `"${it._id}"`,
                  `"${(it.originalName || it.filename || '').replace(/"/g, '""')}"`,
                  `"${it.createdAt || ''}"`,
                  `"${it.mimeType || ''}"`,
                  `${it.size || 0}`,
                  `${detections.length}`,
                  `${Math.round((it.avgConfidence || 0) * 100)}`,
                  `"${JSON.stringify(detections).replace(/"/g, '""')}"`
                ];
                rows.push(row.join(','));
              });

              const csv = rows.join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `detection_history_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}><Download className="w-4 h-4" /> Export</Button>
          </div>
        </motion.div>

        <div className="space-y-6">
          {loading ? (
            <div className="text-center p-8">Loading history...</div>
          ) : items.length === 0 ? (
            <div className="text-center p-8">No history yet. Upload images to populate history.</div>
          ) : (
            items.map((item, index) => (
              <motion.div key={item._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                <Card className="p-6 bg-card border-2 hover:border-primary/50 transition-colors">
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0">
                      {item.url ? (
                        <img src={item.url} alt={item.originalName || item.filename} className="w-28 h-20 object-cover rounded-md border" />
                      ) : (
                        <div className="w-28 h-20 bg-muted/20 rounded-md flex items-center justify-center text-sm text-muted-foreground">No preview</div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold mb-1">{item.originalName || item.filename}</h3>
                          <p className="text-sm text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</p>
                          <div className="mt-2 text-xs text-muted-foreground">
                            <div>Type: {item.mimeType || '—'}</div>
                            <div>Size: {item.size ? `${Math.round(item.size/1024)} KB` : '—'}</div>
                            {item.metadata && Object.keys(item.metadata || {}).length > 0 && (<div className="mt-1">Meta: {JSON.stringify(item.metadata)}</div>)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">{item.detections ? item.detections.length : 0}</div>
                          <div className="text-xs text-muted-foreground">Objects</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {item.detections && item.detections.length ? (
                          item.detections.map((d, i) => {
                            const detectedAt = d.detectedAt ? new Date(d.detectedAt).toLocaleString() : '';
                            const detector = (d as any).detector || '';
                            return (
                              <span key={i} title={`${detector} • ${detectedAt}`} className="px-3 py-1 bg-muted rounded-full text-xs font-medium">{d.object} ({Math.round((d.confidence || 0) * 100)}%)</span>
                            )
                          })
                        ) : (
                          <span className="px-3 py-1 bg-muted rounded-full text-xs font-medium">No detections saved</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round((item.avgConfidence || 0) * 100)}%` }} transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }} className="h-full bg-gradient-to-r from-primary via-secondary to-accent" />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-muted-foreground">{Math.round((item.avgConfidence || 0) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 text-center">
          <Button variant="outline" className="px-8">Load More History</Button>
        </motion.div>
      </div>
    </section>
  );
}
