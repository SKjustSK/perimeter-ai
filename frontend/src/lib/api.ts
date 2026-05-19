import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
  boundingBox: [number, number, number, number];
}
