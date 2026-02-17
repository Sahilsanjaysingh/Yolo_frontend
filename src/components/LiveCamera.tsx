import React, { useEffect, useRef, useState } from 'react';

interface Detection {
  object: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number }; // relative 0..1 coords
}

export default function LiveCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf: number | null = null;
    let lastTs = performance.now();
    let frames = 0;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setRunning(true);
      } catch (e: any) {
        setError('Unable to access camera: ' + (e?.message || e));
      }
    }

    start();

    function drawLoop() {
      try {
        const v = videoRef.current;
        const c = canvasRef.current;
        if (v && c) {
          const ctx = c.getContext('2d');
          if (!ctx) return;
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          ctx.clearRect(0, 0, c.width, c.height);
          // draw boxes from latest detections
          detections.forEach(d => {
            const x = d.bbox.x * c.width;
            const y = d.bbox.y * c.height;
            const w = d.bbox.width * c.width;
            const h = d.bbox.height * c.height;
            ctx.strokeStyle = 'rgba(138, 43, 226, 0.9)';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, w, h);
            ctx.fillStyle = 'rgba(138, 43, 226, 0.9)';
            ctx.font = '18px sans-serif';
            const text = `${d.object} ${Math.round(d.confidence * 100)}%`;
            ctx.fillRect(x, Math.max(0, y - 22), ctx.measureText(text).width + 10, 22);
            ctx.fillStyle = '#fff';
            ctx.fillText(text, x + 5, y - 6);
          });
        }
      } catch (e) {
        // drawing errors are non-fatal
      }

      frames++;
      const now = performance.now();
      if (now - lastTs >= 1000) {
        setFps(frames);
        frames = 0;
        lastTs = now;
      }
      raf = requestAnimationFrame(drawLoop);
    }

    raf = requestAnimationFrame(drawLoop);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(t => t.stop());
      setRunning(false);
    };
  }, [detections]);

  // capture a single frame and send to model endpoint for detection
  const runDetection = async () => {
    try {
      const v = videoRef.current;
      if (!v) return;
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(b => resolve(b), 'image/jpeg', 0.9));
      if (!blob) return;

      const apiBase =  'http://127.0.0.1:5000';
      // send frame to detection endpoint
      const form = new FormData();
      form.append('file', new File([blob], `frame-${Date.now()}.jpg`, { type: 'image/jpeg' }));

      const res = await fetch(`${apiBase}/predict`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        setError('Detection failed: ' + text);
        return;
      }

      const json = await res.json();
      // expect { detections: [{ object, confidence, bbox: { x,y,width,height } }] }
     const transformedDetections = json.map(d => {
  const v = videoRef.current;
  if (!v) return null;
  return {
    object: d.class_name,
    confidence: d.confidence,
    bbox: {
      x: d.box[0] / v.videoWidth,
      y: d.box[1] / v.videoHeight,
      width: (d.box[2] - d.box[0]) / v.videoWidth,
      height: (d.box[3] - d.box[1]) / v.videoHeight
    }
  };
}).filter(Boolean); // This removes any nulls

setDetections(transformedDetections);

    } catch (e: any) {
      setError('Detection error: ' + (e?.message || e));
    }
  };

  // capture current frame and upload along with detections to backend uploads endpoint
  const saveDetection = async () => {
    try {
      const v = videoRef.current;
      if (!v) return;
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(b => resolve(b), 'image/jpeg', 0.9));
      if (!blob) return;

      const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';
      const form = new FormData();
      form.append('file', new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      form.append('detections', JSON.stringify(detections || []));

      const res = await fetch(`${apiBase}/api/upload`, { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      // dispatch event so History updates automatically
      try { window.dispatchEvent(new CustomEvent('image-created', { detail: json })); } catch (e) {}
    } catch (e: any) {
      setError('Save error: ' + (e?.message || e));
    }
  };

  return (
    <div className="p-4">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card p-4 rounded-lg">
          <div className="relative">
            <video ref={videoRef} className="w-full rounded-md bg-black" playsInline muted />
            <canvas ref={canvasRef} className="absolute left-0 top-0 w-full h-full pointer-events-none" />
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-muted-foreground">Camera {running ? 'active' : 'inactive'} • {fps} FPS</div>
            <div className="flex gap-2">
              <button className="btn" onClick={() => void runDetection()}>Run Detection</button>
              <button className="btn" onClick={() => void saveDetection()}>Save Capture</button>
            </div>
          </div>
          {error && <div className="text-sm text-red-400 mt-2">{error}</div>}
        </div>

        <div className="bg-card p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Live Detections</h3>
          <div className="space-y-3">
            {detections.length === 0 ? (
              <div className="text-sm text-muted-foreground">No detections yet. Click Run Detection.</div>
            ) : (
              detections.map((d, i) => (
                <div key={i} className="p-3 bg-muted/30 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{d.object}</div>
                      <div className="text-xs text-muted-foreground">{Math.round(d.confidence * 100)}% confidence</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{Math.round(d.bbox.width * 100)}% width</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
