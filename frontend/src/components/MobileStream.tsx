import React, { useRef, useState, useEffect } from 'react';
import { Camera, CameraOff, RefreshCw, X } from 'lucide-react';

interface MobileStreamProps {
  cameraId: string;
  cameraName: string;
  backendWsUrl: string;
  onClose: () => void;
}

const MobileStream: React.FC<MobileStreamProps> = ({ cameraId, cameraName, backendWsUrl, onClose }) => {
  const [streaming, setStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Starts the browser camera stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: 640, height: 480 },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Failed to access camera:', error);
      alert('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      stopStreaming();
    };
  }, [facingMode]);

  const startStreaming = () => {
    if (streaming) return;

    // Connect to WebSocket server in backend
    const wsUrl = `${backendWsUrl}?cameraId=${cameraId}`;
    console.log(`Connecting WebSocket to: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket stream connection established');
      setStreaming(true);

      // Canvas loop to capture frames at 5 FPS (every 200ms)
      intervalRef.current = setInterval(() => {
        if (canvasRef.current && videoRef.current && socket.readyState === WebSocket.OPEN) {
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');
          const video = videoRef.current;

          if (context) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert canvas drawing to JPEG Blob
            canvas.toBlob((blob) => {
              if (blob) {
                // Send binary frame over WebSocket
                socket.send(blob);
              }
            }, 'image/jpeg', 0.6); // Compress quality
          }
        }
      }, 200);
    };

    socket.onerror = (err) => {
      console.error('WebSocket Error:', err);
      alert('WebSocket streaming error');
      stopStreaming();
    };

    socket.onclose = () => {
      console.log('WebSocket stream connection closed');
      stopStreaming();
    };
  };

  const stopStreaming = () => {
    setStreaming(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  };

  const toggleCamera = () => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(5, 5, 5, 0.95)', zIndex: 1000, display: 'flex',
      flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px',
      color: 'white', padding: '16px', boxSizing: 'border-box'
    }}>
      {/* Header controls */}
      <div style={{ width: '100%', maxWidth: '500px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#10b981' }}>Live Streaming Feed</h2>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Camera: {cameraName}</span>
        </div>
        <button 
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Video Container */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: '500px', aspectRatio: '4/3',
        background: '#000', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <video 
          ref={videoRef} autoPlay playsInline muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Pulsing indicator */}
        {streaming && (
          <div style={{
            position: 'absolute', top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(239, 68, 68, 0.8)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold'
          }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%', background: '#fff',
              animation: 'pulse 1.5s infinite'
            }} />
            BROADCASTING LIVE
          </div>
        )}
      </div>

      {/* Controls panel */}
      <div style={{ display: 'flex', gap: '16px', width: '100%', maxWidth: '500px' }}>
        <button
          onClick={streaming ? stopStreaming : startStreaming}
          style={{
            flex: 1, padding: '14px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '1rem',
            background: streaming ? '#ef4444' : '#10b981', color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: streaming ? '0 4px 12px rgba(239, 68, 68, 0.3)' : '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}
        >
          {streaming ? (
            <>
              <CameraOff size={18} /> Stop Stream
            </>
          ) : (
            <>
              <Camera size={18} /> Start Broadcast
            </>
          )}
        </button>

        <button
          onClick={toggleCamera}
          style={{
            padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="Switch Camera Flip"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Animation Style helper */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
        }
      `}</style>
    </div>
  );
};

export default MobileStream;
