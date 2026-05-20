import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import type { Camera, Job, JobStatus } from '@/lib/api';
import axios from 'axios';
import { Camera as CameraIcon, Video, AlertCircle, RefreshCw, Loader2, Play, CheckCircle2, XCircle, FileText, Upload } from 'lucide-react';

export function Manage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoadingCameras, setIsLoadingCameras] = useState(true);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Camera form states
  const [camName, setCamName] = useState('');
  const [camLocation, setCamLocation] = useState('');
  const [camLat, setCamLat] = useState('');
  const [camLng, setCamLng] = useState('');
  const [isAddingCamera, setIsAddingCamera] = useState(false);
  const [cameraSuccess, setCameraSuccess] = useState(false);

  // Upload Video form states
  const [selectedCamId, setSelectedCamId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStep, setUploadStep] = useState<'idle' | 'presigning' | 'uploading' | 'queueing' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Background polling ref
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // System Reset states
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleSystemReset = async () => {
    const confirmReset = window.confirm(
      "WARNING: This will delete all cameras and jobs in the PostgreSQL database, and delete all target vector points in the Qdrant database. It will then seed the default New York cameras. This action cannot be undone.\n\nAre you sure you want to proceed?"
    );

    if (!confirmReset) return;

    setIsResetting(true);
    setResetSuccess(false);
    setResetError(null);

    try {
      await api.post('/cameras/reset');
      setResetSuccess(true);
      fetchCameras();
      fetchJobs();
    } catch (err: any) {
      console.error('System reset failed:', err);
      setResetError(err.response?.data?.error || 'Failed to complete system reset.');
    } finally {
      setIsResetting(false);
    }
  };

  // Fetch cameras list
  const fetchCameras = async () => {
    setIsLoadingCameras(true);
    try {
      const response = await api.get<Camera[]>('/cameras');
      setCameras(response.data);
    } catch (err: any) {
      console.error('Error fetching cameras:', err);
    } finally {
      setIsLoadingCameras(false);
    }
  };

  // Fetch jobs list
  const fetchJobs = async () => {
    try {
      const response = await api.get<Job[]>('/videos');
      setJobs(response.data);
    } catch (err: any) {
      console.error('Error fetching jobs:', err);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  // Run on mount
  useEffect(() => {
    fetchCameras();
    fetchJobs();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Monitor jobs and trigger polling if any are active
  useEffect(() => {
    const hasActiveJobs = jobs.some(
      (job) => job.status === 'PENDING' || job.status === 'QUEUED' || job.status === 'PROCESSING'
    );

    if (hasActiveJobs) {
      if (!pollIntervalRef.current) {
        console.log('[*] Active jobs detected. Starting polling interval.');
        pollIntervalRef.current = setInterval(() => {
          fetchJobs();
        }, 4000); // Poll every 4 seconds
      }
    } else {
      if (pollIntervalRef.current) {
        console.log('[*] All jobs processed. Stopping polling.');
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [jobs]);

  // Form handlers
  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!camName || !camLocation || !camLat || !camLng) {
      setError('Please fill in all camera details.');
      return;
    }

    const lat = parseFloat(camLat);
    const lng = parseFloat(camLng);

    if (isNaN(lat) || isNaN(lng)) {
      setError('Latitude and Longitude must be valid numbers.');
      return;
    }

    setIsAddingCamera(true);
    setError(null);
    setCameraSuccess(false);

    try {
      await api.post('/cameras', {
        name: camName,
        location: camLocation,
        latitude: lat,
        longitude: lng,
      });

      setCamName('');
      setCamLocation('');
      setCamLat('');
      setCamLng('');
      setCameraSuccess(true);
      fetchCameras(); // Refresh dropdown list
    } catch (err: any) {
      console.error('Error creating camera:', err);
      setError(err.response?.data?.error || 'Failed to register camera node.');
    } finally {
      setIsAddingCamera(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
      setUploadStep('idle');
    }
  };

  const handleUploadVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCamId) {
      setUploadError('Please select a camera registry.');
      return;
    }
    if (!selectedFile) {
      setUploadError('Please select a video file.');
      return;
    }

    setUploadStep('presigning');
    setUploadProgress(0);
    setUploadError(null);

    try {
      // Step 1: Request Signed URL
      const uploadRes = await api.post<{ jobId: string; uploadUrl: string; s3Key: string }>('/videos/upload', {
        fileName: selectedFile.name,
        cameraId: selectedCamId,
      });

      const { jobId, uploadUrl } = uploadRes.data;

      // Step 2: Binary PUT directly to MinIO S3
      setUploadStep('uploading');
      await axios.put(uploadUrl, selectedFile, {
        headers: {
          'Content-Type': selectedFile.type || 'video/mp4',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });

      // Step 3: Trigger Redis queue worker
      setUploadStep('queueing');
      await api.post('/videos/process', { jobId });

      setUploadStep('success');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchJobs(); // Trigger refresh/polling
    } catch (err: any) {
      console.error('Video upload pipeline failed:', err);
      setUploadStep('error');
      setUploadError(err.response?.data?.error || 'Failed to complete video upload pipeline.');
    }
  };

  // Helper for status badges style
  const getStatusStyle = (status: JobStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'QUEUED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'PROCESSING':
        return 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse';
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'FAILED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }
  };

  return (
    <div className="pt-24 max-w-5xl mx-auto space-y-6 px-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Management Control</h1>
        <p className="text-sm text-muted-foreground mt-1">Register cameras, upload footage and monitor active processing pipelines.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column: Forms */}
        <div className="space-y-6">
          {/* Add Camera Form Card */}
          <div className="bg-background border border-border rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <CameraIcon className="h-4 w-4 text-primary" />
              Register Camera Node
            </h2>
            <form onSubmit={handleAddCamera} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Camera Name</label>
                <input
                  type="text"
                  placeholder="e.g. Lobby Entrance"
                  value={camName}
                  onChange={(e) => setCamName(e.target.value)}
                  className="w-full border border-input rounded-md px-3 py-2 text-xs bg-muted/20 outline-none focus:border-ring transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Physical Location</label>
                <input
                  type="text"
                  placeholder="e.g. Building A - Floor 1"
                  value={camLocation}
                  onChange={(e) => setCamLocation(e.target.value)}
                  className="w-full border border-input rounded-md px-3 py-2 text-xs bg-muted/20 outline-none focus:border-ring transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Latitude</label>
                  <input
                    type="text"
                    placeholder="e.g. 40.7128"
                    value={camLat}
                    onChange={(e) => setCamLat(e.target.value)}
                    className="w-full border border-input rounded-md px-3 py-2 text-xs bg-muted/20 outline-none focus:border-ring transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Longitude</label>
                  <input
                    type="text"
                    placeholder="e.g. -74.0060"
                    value={camLng}
                    onChange={(e) => setCamLng(e.target.value)}
                    className="w-full border border-input rounded-md px-3 py-2 text-xs bg-muted/20 outline-none focus:border-ring transition-colors font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isAddingCamera}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isAddingCamera && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Add Camera Node
              </button>

              {cameraSuccess && (
                <div className="text-[10px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Camera node successfully registered!
                </div>
              )}
              {error && (
                <div className="text-[10px] text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {error}
                </div>
              )}
            </form>
          </div>

          {/* Upload Video Form Card */}
          <div className="bg-background border border-border rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              Upload Surveillance Footage
            </h2>
            <form onSubmit={handleUploadVideo} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Source Camera Node</label>
                {isLoadingCameras ? (
                  <div className="text-xs text-muted-foreground py-2 flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading camera registries...
                  </div>
                ) : (
                  <select
                    value={selectedCamId}
                    onChange={(e) => setSelectedCamId(e.target.value)}
                    className="w-full border border-input rounded-md px-3 py-2 text-xs bg-muted/20 outline-none focus:border-ring transition-colors"
                  >
                    <option value="">Select a camera...</option>
                    {cameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.name} ({cam.location})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Footage File (.mp4)</label>
                <input
                  type="file"
                  accept="video/mp4"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-input file:text-xs file:font-medium file:bg-background file:text-foreground hover:file:bg-accent cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={uploadStep === 'presigning' || uploadStep === 'uploading' || uploadStep === 'queueing'}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload and Queue Job
              </button>

              {/* Upload stages UI feedback */}
              {uploadStep !== 'idle' && (
                <div className="space-y-2 pt-1">
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-medium">
                    {uploadStep === 'presigning' && (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        Generating pre-signed URL...
                      </>
                    )}
                    {uploadStep === 'uploading' && (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        Uploading footage to MinIO S3... ({uploadProgress}%)
                      </>
                    )}
                    {uploadStep === 'queueing' && (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        Queueing pipeline worker...
                      </>
                    )}
                    {uploadStep === 'success' && (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-emerald-600 font-semibold">Video queued successfully!</span>
                      </>
                    )}
                    {uploadStep === 'error' && (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                        <span className="text-destructive font-semibold">Pipeline setup failed</span>
                      </>
                    )}
                  </div>

                  {uploadStep === 'uploading' && (
                    <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                      <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  )}
                </div>
              )}

              {uploadError && (
                <div className="text-[10px] text-destructive flex items-start gap-1 p-2 bg-destructive/5 border border-destructive/15 rounded">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right column: Jobs tracker & operations */}
        <div className="space-y-6">
          {/* Jobs tracker card */}
          <div className="bg-background border border-border rounded-xl shadow-sm p-5 flex flex-col max-h-[530px]">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" />
                Surveillance Pipelines
              </h2>
              <button
                onClick={fetchJobs}
                disabled={isLoadingJobs}
                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                title="Refresh jobs list"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingJobs ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pt-2 space-y-3">
              {isLoadingJobs && jobs.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Loading pipeline registry...
                </div>
              ) : jobs.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <p>No video pipelines have been created.</p>
                  <p className="text-[10px] mt-0.5">Surveillance footage uploaded above will appear here.</p>
                </div>
              ) : (
                jobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-3 border border-border rounded-lg bg-muted/10 space-y-2 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                        ID: {job.id}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getStatusStyle(job.status)}`}>
                        {job.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                      <div>
                        <span className="block font-medium">Camera:</span>
                        <span className="text-foreground font-medium">{job.camera?.name || 'Unknown'}</span>
                      </div>
                      <div>
                        <span className="block font-medium">Created:</span>
                        <span className="text-foreground">{new Date(job.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {job.errorLog && (
                      <div className="p-2 bg-destructive/5 border border-destructive/15 rounded flex items-start gap-1 text-[9px] text-destructive">
                        <FileText className="h-3 w-3 shrink-0 mt-0.5" />
                        <span className="font-mono break-all">{job.errorLog}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* System Operations Card */}
          <div className="bg-background border border-border rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold tracking-tight text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 animate-pulse" />
              System Operations
            </h2>
            <p className="text-xs text-muted-foreground">
              Wipe all database records (cameras & jobs), drop and recreate the Qdrant vector targets collection, and re-seed the default 3 cameras.
            </p>
            <button
              onClick={handleSystemReset}
              disabled={isResetting}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white rounded-md text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              {isResetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertCircle className="h-3.5 w-3.5" />}
              Reset System Database & Vectors
            </button>

            {resetSuccess && (
              <div className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium animate-in fade-in duration-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                System successfully reset and re-seeded.
              </div>
            )}
            {resetError && (
              <div className="text-[10px] text-destructive flex items-start gap-1 p-2 bg-destructive/5 border border-destructive/15 rounded">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{resetError}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Manage;
