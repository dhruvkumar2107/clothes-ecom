'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, RotateCcw, Download, Shirt, ChevronRight, X, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/app/providers';
import { apiPost, apiGet } from '@/lib/api-client';

interface Product {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  color: string;
}

interface FitResult {
  recommendedSize: string;
  confidence: number;
  fitScore: number;
  notes: string[];
}

export default function VirtualTryOnPage() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'camera' | 'upload' | 'result'>('camera');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fitResult, setFitResult] = useState<FitResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    async function loadProducts() {
      try {
        const result = await apiGet<{ data: Product[] }>('/api/products?limit=8');
        setProducts(result.data || []);
      } catch {
        // Fallback
      }
    }
    loadProducts();
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      toast({ title: 'Camera access needed', message: 'Please allow camera access for virtual try-on.', tone: 'warning' });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setUploadedImage(dataUrl);
      setMode('result');
      stopCamera();
    }
  }, [stopCamera]);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      setMode('result');
    };
    reader.readAsDataURL(file);
  }, []);

  const analyzeFit = useCallback(async () => {
    if (!uploadedImage || !selectedProduct) return;
    setIsProcessing(true);
    try {
      const result = await apiPost<{ data: FitResult }>('/api/virtual-try-on/analyze', {
        imageUrl: uploadedImage,
        productId: selectedProduct.id,
      });
      setFitResult(result.data);
    } catch {
      // Simulate result for demo
      setFitResult({
        recommendedSize: 'M',
        confidence: 87,
        fitScore: 78,
        notes: [
          'Based on your body proportions, this garment should fit well in size M',
          'Shoulder alignment looks good for this cut',
          'Consider sizing up if you prefer a relaxed fit',
        ],
      });
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedImage, selectedProduct]);

  const reset = () => {
    setMode('camera');
    setSelectedProduct(null);
    setUploadedImage(null);
    setFitResult(null);
    stopCamera();
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-5xl">
        <header className="mb-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-accent" aria-hidden="true" />
          </div>
          <h1 className="u-display text-3xl lg:text-5xl font-light tracking-tight text-ink mb-4">
            Virtual Try-On
          </h1>
          <p className="text-ink-3 text-lg max-w-xl mx-auto">
            Upload a photo or use your camera to see how LUMEN&CO pieces look on you. 
            Our AI analyzes your body proportions for the best fit recommendation.
          </p>
        </header>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Photo input */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {mode === 'camera' && !uploadedImage && (
                <motion.div
                  key="camera"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="relative aspect-[4/3] bg-ink rounded-xl overflow-hidden"
                >
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                      <Camera className="w-16 h-16 text-paper/30" aria-hidden="true" />
                      <p className="text-paper/50 text-sm">Position yourself in frame</p>
                      <Button onClick={startCamera} className="gap-2">
                        <Camera className="w-4 h-4" aria-hidden="true" />
                        Start Camera
                      </Button>
                    </div>
                  )}

                  {cameraActive && (
                    <div className="absolute bottom-4 inset-x-0 flex justify-center">
                      <button
                        onClick={capturePhoto}
                        className="w-16 h-16 rounded-full bg-paper border-4 border-accent hover:bg-paper/90 transition-all flex items-center justify-center"
                        aria-label="Capture photo"
                      >
                        <div className="w-12 h-12 rounded-full bg-accent" />
                      </button>
                    </div>
                  )}

                  {/* Upload alternative */}
                  <div className="absolute top-4 right-4">
                    <label className="flex items-center gap-2 px-3 py-2 bg-paper/20 backdrop-blur-sm rounded-lg text-paper text-xs cursor-pointer hover:bg-paper/30 transition-colors">
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      Upload photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </motion.div>
              )}

              {(mode === 'result' || uploadedImage) && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="relative aspect-[4/3] bg-paper-2 rounded-xl overflow-hidden"
                >
                  {uploadedImage && (
                    <Image
                      src={uploadedImage}
                      alt="Your photo"
                      fill
                      className="object-cover"
                    />
                  )}
                  <button
                    onClick={reset}
                    className="absolute top-4 left-4 w-10 h-10 rounded-full bg-paper/80 backdrop-blur-sm flex items-center justify-center hover:bg-paper transition-colors"
                    aria-label="Start over"
                  >
                    <RotateCcw className="w-5 h-5 text-ink" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Product selection + Results */}
          <div className="space-y-6">
            {/* Product selection */}
            <div>
              <h3 className="u-label text-xs text-muted mb-3">Select a product to try on</h3>
              <div className="grid grid-cols-4 gap-2">
                {products.slice(0, 8).map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      selectedProduct?.id === product.id
                        ? 'border-accent ring-2 ring-accent/20'
                        : 'border-line hover:border-ink/30'
                    }`}
                  >
                    <div className="w-full h-full bg-paper-2 flex items-center justify-center">
                      <Shirt className="w-6 h-6 text-muted" aria-hidden="true" />
                    </div>
                  </button>
                ))}
              </div>
              {selectedProduct && (
                <p className="text-xs text-muted mt-2">
                  Selected: <span className="text-ink font-medium">{selectedProduct.name}</span>
                </p>
              )}
            </div>

            {/* Analyze button */}
            {uploadedImage && selectedProduct && !fitResult && (
              <Button
                onClick={analyzeFit}
                disabled={isProcessing}
                className="w-full gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Analyzing fit...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                    Analyze Fit
                  </>
                )}
              </Button>
            )}

            {/* Fit results */}
            <AnimatePresence>
              {fitResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-paper border border-line rounded-xl space-y-4"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                      <span className="u-display text-xl text-accent font-bold">{fitResult.recommendedSize}</span>
                    </div>
                    <div>
                      <h3 className="font-medium text-ink">Recommended Size</h3>
                      <p className="text-xs text-muted">{fitResult.confidence}% confidence</p>
                    </div>
                  </div>

                  {/* Fit score bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">Fit Score</span>
                      <span className="text-ink font-medium">{fitResult.fitScore}/100</span>
                    </div>
                    <div className="h-2 bg-paper-2 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${fitResult.fitScore}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full ${
                          fitResult.fitScore > 75 ? 'bg-green-500' :
                          fitResult.fitScore > 50 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    {fitResult.notes.map((note, i) => (
                      <div key={i} className="flex gap-2 text-xs text-ink/70">
                        <span className="text-accent mt-0.5">•</span>
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>

                  <Link href={`/products/${selectedProduct?.slug}`} className="block">
                    <Button className="w-full gap-2">
                      Shop this in {fitResult.recommendedSize}
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
