import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MINIO_URL = import.meta.env.VITE_MINIO_URL || 'http://localhost:9000';
const CROPS_BUCKET = 'surveillance-crops';

/**
 * Builds a direct MinIO URL for a persisted person crop image.
 * Returns null if no key is provided (e.g. older vectors before crop persistence was added).
 */
export const getCropUrl = (cropS3Key: string | null | undefined): string | null => {
  if (!cropS3Key) return null;
  return `${MINIO_URL}/${CROPS_BUCKET}/${cropS3Key}`;
};

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Camera {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

export type JobStatus = 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Job {
  id: string;
  status: JobStatus;
  s3Key: string;
  cameraId: string;
  camera?: Camera;
  errorLog?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchResult {
  confidence: string;
  cameraId: string;
  jobId: string;
  frameNumber: number;
  timestampSeconds: number | null;
  detectedAt: string | null;
  boundingBox: [number, number, number, number];
  cropS3Key?: string | null;
}

/**
 * Formats a raw seconds value (video offset) into MM:SS or HH:MM:SS.
 * Used as a fallback when detectedAt is unavailable.
 */
export const formatTimestamp = (seconds: number | null | undefined): string | null => {
  if (seconds == null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Formats an ISO timestamp string into a compact or verbose human-readable label.
 * compact=true  →  "Jun 20 at 2:35 PM"   (for list row badges)
 * compact=false →  "Friday, June 20, 2025 at 2:35 PM"  (for details panel)
 */
export const formatDetectedAt = (iso: string | null | undefined, compact = false): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;

  if (compact) {
    const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${datePart} at ${timePart}`;
  }

  const datePart = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  return `${datePart} at ${timePart}`;
};
