import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import axios from 'axios';

interface DetectionResult {
  object: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export default function DetectionInterface() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageDoc, setImageDoc] = useState<any | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // indicate copy (helpful for some browsers)
    try {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    } catch (err) {
      // ignore
    }
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setResults([]);

    // upload to backend
    const upload = async () => {
      setIsUploading(true);
      let fresh: any = null;
      try {
        const form = new FormData();
        form.append('file', file);

        const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000'
        const res = await fetch(`${apiBase}/api/upload`, {
          method: 'POST',
          body: form,
        });

        if (!res.ok) {
          throw new Error('Upload failed');
        }

  const json = await res.json();
  // fetch fresh doc by id to ensure we have the server-side fields (avgConfidence, _id)
  fresh = json;
        try {
          const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000'
          if (json && json._id) {
            const r = await fetch(`${apiBase}/api/images/${json._id}`);
            if (r.ok) fresh = await r.json();
          }
        } catch (e) {
          // ignore fetch error and use original json
        }
        setImageDoc(fresh);
        // notify listeners that a new image was created
        try {
          window.dispatchEvent(new CustomEvent('image-created', { detail: fresh }));
        } catch (e) {}
        if (json && json.url) {
          // revoke previous preview if present
          try { if (previewUrl) URL.revokeObjectURL(previewUrl) } catch (err) {}
          setPreviewUrl(json.url);
        } else {
          // fallback to local preview
          try { if (previewUrl) URL.revokeObjectURL(previewUrl) } catch (err) {}
          setPreviewUrl(URL.createObjectURL(file));
        }
      } catch (err: any) {
        console.error('Upload error', err);
        setImageDoc(null)
        // fallback to local preview if upload fails
        try { if (previewUrl) URL.revokeObjectURL(previewUrl) } catch (e) {}
        setPreviewUrl(URL.createObjectURL(file));
        // show user-friendly error
        // eslint-disable-next-line no-console
        setTimeout(() => {}, 0)
      } finally {
        setIsUploading(false);
        // if upload succeeded and no detection results yet, run detection automatically
        try {
          if (!isProcessing && !results.length && fresh && fresh._id) {
            // small delay to allow state to settle, then run detection and pass the server-created image id
            setTimeout(() => { void handleDetect(fresh._id); }, 200);
          }
        } catch (e) {
          // ignore
        }
      }
    };

    void upload();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const inputRef = useRef<HTMLInputElement | null>(null)

  const openFileDialog = () => {
    inputRef.current?.click()
  }

  // revoke object URL to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleDetect = async (imageId?: string) => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setResults([]); // Clear previous results

    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // THIS IS THE REAL API CALL TO YOUR PYTHON BACKEND
      const response = await axios.post('http://127.0.0.1:5000/predict', formData);

      // IMPORTANT: The backend sends 'box' and 'class_name', but your component expects 'bbox' and 'object'.
      // We need to transform the data to match what the frontend expects.
      const transformedResults = response.data.map(res => ({
        object: res.class_name,
        confidence: res.confidence,
        // The backend sends [x1, y1, x2, y2], we convert it to {x, y, width, height}
        bbox: {
          x: res.box[0],
          y: res.box[1],
          width: res.box[2] - res.box[0],
          height: res.box[3] - res.box[1]
        }
      }));
       setResults(transformedResults); // Update the state with the real results

      // If we have an uploaded image doc id (either passed in or from state), persist detections to backend
      try {
        const idToSave = imageId || (imageDoc && imageDoc._id);
        if (idToSave) {
          const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000'
          // attach metadata to each detection
          const enriched = transformedResults.map(d => ({ ...d, detectedAt: new Date().toISOString(), detector: 'yolo' }));
          const putRes = await fetch(`${apiBase}/api/images/${idToSave}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ detections: enriched }),
          });
          if (putRes.ok) {
            const updated = await putRes.json();
            setImageDoc(updated);
            try { window.dispatchEvent(new CustomEvent('image-updated', { detail: updated })); } catch (e) {}
          } else {
            console.warn('PUT /api/images failed', putRes.status);
          }
        }
      } catch (e) {
        console.warn('Failed to persist detections', e);
      }

    } catch (error) {
      console.error("Error detecting objects:", error);
      alert("Failed to connect to the AI server. Please ensure it's running correctly.");
    } finally {
      setIsProcessing(false); // Stop the loading indicator
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setResults([]);
    setIsProcessing(false);
  };

  return (
    <section className="min-h-screen py-20 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold font-serif mb-4">
            AI Detection <span className="text-primary">Interface</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload an image from a space station to detect safety equipment in real-time
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-8 bg-card border-2">
              <h3 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <ImageIcon className="w-6 h-6 text-primary" />
                Upload Image
              </h3>

              {!previewUrl ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={openFileDialog}
                  role="button"
                  tabIndex={0}
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
                    isDragging 
                      ? 'border-primary bg-primary/10 scale-105' 
                      : 'border-border hover:border-primary/50 hover:bg-card/50'
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-input"
                  />
                    <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2">
                      Drag & drop your image here
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      or click to browse
                    </p>
                    <Button className="bg-primary hover:bg-primary/90" onClick={(e) => { e.stopPropagation(); openFileDialog(); }}>
                      Select Image
                    </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative group">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full rounded-xl border-2 border-border"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={clearSelection}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => void handleDetect(imageDoc?._id)}
                      disabled={isProcessing}
                      className="flex-1 bg-primary hover:bg-primary/90 text-lg py-6"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          Start Detection
                        </>
                      )}
                    </Button>
                  </div>

                  {isProcessing && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Analyzing image...</span>
                        <span className="text-primary font-mono">Running YOLO model</span>
                      </div>
                      <Progress value={65} className="h-2" />
                    </div>
                  )}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Results Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-8 bg-card border-2 min-h-[500px]">
              <h3 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-accent" />
                Detection Results
              </h3>

              <AnimatePresence mode="wait">
                {results.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-[400px] text-center"
                  >
                    <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <ImageIcon className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      {isProcessing ? 'AI is analyzing your image...' : 'Upload an image to see detection results'}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                        <span className="font-semibold">
                          {results.length} Object{results.length !== 1 ? 's' : ''} Detected
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground font-mono">
                        {new Date().toLocaleTimeString()}
                      </span>
                    </div>

                    {results.map((result, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-lg">{result.object}</h4>
                            <p className="text-sm text-muted-foreground font-mono">
                              Confidence: {(result.confidence * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            result.confidence > 0.9 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {result.confidence > 0.9 ? 'High' : 'Medium'}
                          </div>
                        </div>
                        <Progress 
                          value={result.confidence * 100} 
                          className="h-2"
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        </div>

        {/* API Connection Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12"
        >
          <Card className="p-6 bg-muted/30 border-2 border-primary/20">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              API Connection
            </h4>
            <p className="text-sm text-muted-foreground font-mono">
              Ready to connect to your Python YOLO backend. Update the API endpoint in the code to enable real detections.
            </p>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}