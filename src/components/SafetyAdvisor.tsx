import { useEffect, useMemo, useRef, useState } from 'react';
import useNow from '../hooks/use-now';
import { motion } from 'framer-motion';
import { Button } from './ui/button';

export default function SafetyAdvisor() {
  const [images, setImages] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';
        const res = await fetch(`${apiBase}/api/images`);
        const json = await res.json();
        // API already returns images sorted by createdAt desc. Keep that order
        // so the most recent image is first in the list.
        const arr = Array.isArray(json) ? json : [];
        setImages(arr);
        // select the most recent image by default if none selected
        if (arr.length) setSelected(prev => prev || arr[0]);
      } catch (e) {
        console.error('load images', e);
      }
    };
    void load();
    // realtime updates
    const onCreated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setImages(prev => [detail, ...prev]);
      // select the newly created image and scroll list to top so it's visible
      setSelected(detail);
      if (listRef.current) listRef.current.scrollTop = 0;
    };
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setImages(prev => prev.map(img => (img._id === detail._id ? detail : img)));
      if (selected && (detail._id === selected._id)) setSelected(detail);
    };
    window.addEventListener('image-created', onCreated as EventListener);
    window.addEventListener('image-updated', onUpdated as EventListener);
    return () => {
      window.removeEventListener('image-created', onCreated as EventListener);
      window.removeEventListener('image-updated', onUpdated as EventListener);
    };
  }, []);

  // tick to refresh displayed timestamps
  useNow(30000);

  const evaluate = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';
      const res = await fetch(`${apiBase}/api/risk/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: selected._id })
      });
      const json = await res.json();
      setResult(json.result);
    } catch (e) {
      console.error('evaluate', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h2 className="text-3xl font-bold">Safety Advisor</h2>
          <p className="text-sm text-muted-foreground">Evaluate image risk and get suggested actions.</p>
        </motion.div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 bg-card border border-border rounded-2xl p-4">
            <h3 className="font-semibold mb-3">Recent Images</h3>
            <div ref={listRef} className="space-y-2 max-h-[60vh] overflow-y-auto">
              {images.map(img => (
                <button key={img._id} onClick={() => { setSelected(img); setResult(null); }} className={`w-full text-left p-2 rounded-lg ${selected && selected._id === img._id ? 'bg-primary/10' : 'hover:bg-muted/60'}`}>
                  <div className="text-sm font-medium">{img.originalName || img.filename}</div>
                  <div className="text-xs text-muted-foreground">{new Date(img.createdAt).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-2 bg-card border border-border rounded-2xl p-4">
            {!selected ? (
              <div className="text-muted-foreground">Select an image to evaluate risk</div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <img src={selected.url} alt="preview" className="w-80 h-48 object-cover rounded-md border" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{selected.originalName || selected.filename}</h3>
                        <div className="text-xs text-muted-foreground">{new Date(selected.createdAt).toLocaleString()}</div>
                      </div>
                      <div>
                        <Button onClick={evaluate} disabled={loading} className="bg-primary">{loading ? 'Evaluating...' : 'Evaluate Risk'}</Button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <h4 className="text-sm font-medium">Detections</h4>
                      <div className="flex gap-2 flex-wrap mt-2">
                        {(selected.detections || []).map((d: any, i: number) => (
                          <div key={i} className="px-3 py-1 rounded-full bg-muted text-sm">{d.object} ({Math.round((d.confidence||0)*100)}%)</div>
                        ))}
                      </div>
                    </div>

                    {result && (
                      <div className="mt-4 p-4 border border-border rounded-md bg-muted/40">
                        <h4 className="font-semibold">Risk: {result.category} ({result.score})</h4>
                        <p className="text-sm text-muted-foreground mt-2">{result.explanation}</p>

                        <div className="mt-3">
                          <h5 className="font-medium">Recommended Actions</h5>
                          <ol className="list-decimal ml-5 mt-2 space-y-2">
                            {(result.actions || []).map((a: any, idx: number) => (
                              <li key={idx}>
                                <div className="font-semibold">{a.title}</div>
                                <div className="text-sm text-muted-foreground">{a.description}</div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium">Raw JSON</h4>
                  <pre className="text-xs p-3 bg-background border rounded-md max-h-40 overflow-auto">{JSON.stringify(selected, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
