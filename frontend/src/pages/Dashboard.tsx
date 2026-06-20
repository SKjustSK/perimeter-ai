import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Camera, MatchResult } from '@/lib/api';
import { getCropUrl, formatTimestamp, formatDetectedAt } from '@/lib/api';
import { CameraMap } from '@/components/map/CameraMap';
import { MapPin, AlertCircle, RefreshCw, Radio, Search, X, Navigation, Upload, CheckCircle2, Clock } from 'lucide-react';

export function Dashboard() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Target search states
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<MatchResult[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchCameras = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<Camera[]>('/cameras');
      setCameras(response.data);
    } catch (err: any) {
      console.error('Error fetching cameras:', err);
      setError('Failed to fetch registered cameras. Check backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  // Filter cameras based on search input
  const filteredCameras = cameras.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTargetFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setSearchError(null);
      setSearchResults([]);
      setSelectedMatch(null);
      setHasSearched(false);
    }
  };

  const handleClearSearch = () => {
    setTargetFile(null);
    setPreviewUrl(null);
    setSearchResults([]);
    setSelectedMatch(null);
    setSearchError(null);
    setHasSearched(false);
  };

  const handleSearch = async () => {
    if (!targetFile) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setSelectedMatch(null);
    setHasSearched(false);

    const formData = new FormData();
    formData.append('image', targetFile);

    try {
      const response = await api.post<{ matches: MatchResult[] }>('/search/target', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setSearchResults(response.data.matches);
      setHasSearched(true);
    } catch (err: any) {
      console.error('Target search failed:', err);
      setSearchError(err.response?.data?.error || 'Target search pipeline failed. Is Qdrant/Python offline?');
    } finally {
      setIsSearching(false);
    }
  };

  // Find camera by ID helper
  const getCameraById = (id: string): Camera | undefined => {
    return cameras.find((c) => c.id === id);
  };

  const handleSelectMatch = (match: MatchResult) => {
    setSelectedMatch(match);
    const camera = getCameraById(match.cameraId);
    if (camera) {
      setSelectedCamera(camera);
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* 1. Fullscreen Map Layer */}
      <div className="absolute inset-0 w-full h-full z-0">
        <CameraMap
          cameras={filteredCameras}
          selectedCamera={selectedCamera}
          onSelectCamera={(cam) => {
            setSelectedCamera(cam);
            // Clear match selection if clicking camera map marker directly
            setSelectedMatch(null);
          }}
        />
      </div>

      {/* 2. Floating Camera Registry List (Top-Left Side) */}
      <div className="absolute top-24 left-4 z-10 w-80 max-h-[calc(100vh-21rem)] flex flex-col bg-background border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
              Camera Registry ({filteredCameras.length})
            </h2>
            <button
              onClick={fetchCameras}
              disabled={isLoading}
              className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Refresh cameras"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter cameras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-muted/50 border border-input rounded-md text-xs outline-none focus:border-ring transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 hover:bg-muted p-0.5 rounded-full text-muted-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Loading database...
            </div>
          ) : error ? (
            <div className="p-4 text-center text-xs text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : filteredCameras.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              {cameras.length === 0 ? (
                <>
                  <p>No cameras registered.</p>
                  <p className="mt-1 font-semibold text-primary">Use Management to add one.</p>
                </>
              ) : (
                <p>No cameras match search query.</p>
              )}
            </div>
          ) : (
            filteredCameras.map((camera) => {
              const isSelected = selectedCamera?.id === camera.id && !selectedMatch;
              return (
                <button
                  key={camera.id}
                  onClick={() => {
                    setSelectedCamera(isSelected ? null : camera);
                    setSelectedMatch(null);
                  }}
                  className={`w-full text-left p-3.5 transition-colors hover:bg-muted flex flex-col gap-1 ${
                    isSelected ? 'bg-secondary' : ''
                  }`}
                >
                  <span className="font-medium text-xs text-foreground">{camera.name}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {camera.location}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Floating Target Search Card (Bottom-Left Side) */}
      <div className="absolute bottom-4 left-4 z-10 w-80 bg-background border border-border rounded-xl shadow-lg p-4 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Search</h2>
          {previewUrl && (
            <button
              onClick={handleClearSearch}
              className="text-[10px] text-muted-foreground hover:text-foreground font-medium"
            >
              Reset
            </button>
          )}
        </div>

        {!previewUrl ? (
          <label className="flex flex-col items-center justify-center border border-dashed border-input rounded-lg h-32 hover:bg-accent cursor-pointer transition-colors">
            <Upload className="h-5 w-5 text-muted-foreground mb-1" />
            <span className="text-[11px] font-medium text-muted-foreground">Upload target crop image</span>
            <span className="text-[9px] text-muted-foreground mt-0.5">(PNG, JPG)</span>
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="relative border border-border rounded-lg overflow-hidden h-32 bg-muted/30 flex items-center justify-center">
              <img src={previewUrl} alt="Target crop preview" className="max-h-full max-w-full object-contain" />
              <button
                onClick={handleClearSearch}
                className="absolute top-1.5 right-1.5 p-1 bg-background border border-border rounded-full hover:bg-accent text-muted-foreground hover:text-foreground shadow-sm transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isSearching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Search Target
            </button>
          </div>
        )}

        {searchError && (
          <div className="p-2 border border-destructive/20 rounded bg-destructive/5 text-destructive text-[10px] flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* 4. Floating Selected Camera Details (Right Side - Top) */}
      {selectedCamera && !searchResults.length && (
        <div className="absolute top-24 right-4 z-10 w-80 bg-background border border-border rounded-xl shadow-lg p-4 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Active Node
              </span>
              <h3 className="font-semibold text-sm text-foreground mt-1">{selectedCamera.name}</h3>
            </div>
            <button
              onClick={() => setSelectedCamera(null)}
              className="p-1 hover:bg-muted rounded-full text-muted-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2.5 text-xs border-t border-border pt-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span className="font-medium text-foreground">{selectedCamera.location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Latitude</span>
              <span className="font-mono text-foreground">{selectedCamera.latitude.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Longitude</span>
              <span className="font-mono text-foreground">{selectedCamera.longitude.toFixed(6)}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                const cam = selectedCamera;
                setSelectedCamera(null);
                setTimeout(() => setSelectedCamera(cam), 50);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-input bg-background rounded-md text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Navigation className="h-3.5 w-3.5" />
              Recenter
            </button>
          </div>
        </div>
      )}

      {/* 5. Floating Search Results overlay panel (Right Side) */}
      {(searchResults.length > 0 || isSearching || hasSearched) && (
        <div className="absolute top-24 right-4 z-10 w-80 max-h-[calc(100vh-8rem)] flex flex-col bg-background border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Search Matches</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Detected target matches in footage</p>
            </div>
            <button
              onClick={() => {
                setSearchResults([]);
                setSelectedMatch(null);
                setHasSearched(false);
              }}
              className="p-1 hover:bg-muted rounded-full text-muted-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {isSearching ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                Querying vectors...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">No matches found</p>
                <p className="text-[10px] leading-relaxed">
                  No matching target vectors found in surveillance footage. Make sure you have uploaded video footage and processed the pipelines.
                </p>
              </div>
            ) : (
              searchResults.map((match, idx) => {
                const isSelected = selectedMatch === match;
                const camera = getCameraById(match.cameraId);
                const cropUrl = getCropUrl(match.cropS3Key);
                const detectedLabel = formatDetectedAt(match.detectedAt, true) ?? formatTimestamp(match.timestampSeconds) ?? `Frame ${match.frameNumber}`;
                return (
                  <button
                    key={`${match.jobId}-${match.frameNumber}-${idx}`}
                    onClick={() => handleSelectMatch(match)}
                    className={`w-full text-left p-3.5 transition-colors hover:bg-muted flex items-center gap-3 ${
                      isSelected ? 'bg-secondary' : ''
                    }`}
                  >
                    {/* Crop thumbnail */}
                    <div className="shrink-0 w-10 h-12 rounded-md overflow-hidden border border-border bg-muted/50 flex items-center justify-center">
                      {cropUrl ? (
                        <img
                          src={cropUrl}
                          alt="Person crop"
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <span className="text-[8px] text-muted-foreground text-center leading-tight px-0.5">No img</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {camera ? camera.name : 'Unknown Camera'}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-full flex items-center gap-1 shrink-0 ml-1">
                          <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                          {match.confidence}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {camera ? camera.location : 'Unknown'}
                        </span>
                        <span className="flex items-center gap-0.5 font-mono shrink-0 ml-1">
                          <Clock className="h-2.5 w-2.5 shrink-0" />
                          {detectedLabel}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Mini active match details sub-section inside the results panel */}
          {selectedMatch && (
            <div className="p-4 bg-muted/30 border-t border-border space-y-2 text-xs">
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Selected Match Details
              </span>

              {/* Crop evidence image */}
              {getCropUrl(selectedMatch.cropS3Key) && (
                <div className="mt-2 rounded-lg overflow-hidden border border-border bg-muted/50 flex items-center justify-center" style={{ height: '120px' }}>
                  <img
                    src={getCropUrl(selectedMatch.cropS3Key)!}
                    alt="Matched person crop"
                    className="h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                  />
                </div>
              )}

              <div className="space-y-1.5 pt-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Camera Node</span>
                  <span className="font-medium text-foreground">{getCameraById(selectedMatch.cameraId)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Detected</span>
                  <span className="font-mono text-foreground text-right max-w-[60%]">
                    {formatDetectedAt(selectedMatch.detectedAt) ?? formatTimestamp(selectedMatch.timestampSeconds) ?? `Frame ${selectedMatch.frameNumber}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confidence Score</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{selectedMatch.confidence}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
