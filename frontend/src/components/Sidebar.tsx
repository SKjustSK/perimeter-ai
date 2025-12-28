import React, { useState } from 'react';
import axios from 'axios';
import { Plus, MapPin, Film, ShieldAlert } from 'lucide-react';

interface Camera {
  id: string;
  name: string;
  locationName: string;
  latitude: number;
  longitude: number;
  _count?: { detections: number };
}

interface SidebarProps {
  cameras: Camera[];
  onCameraAdded: () => void;
  backendUrl: string;
}

const Sidebar: React.FC<SidebarProps> = ({ cameras, onCameraAdded, backendUrl }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'upload'>('list');
  
  // Create camera state
  const [name, setName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  
  // Video upload state
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const handleCreateCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !locationName || !lat || !lng) return;

    setLoading(true);
    try {
      await axios.post(`${backendUrl}/api/cameras`, {
        name,
        locationName,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
      });
      setName('');
      setLocationName('');
      setLat('');
      setLng('');
      onCameraAdded();
      setActiveTab('list');
    } catch (error) {
      console.error(error);
      alert('Failed to register camera');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCameraId || !videoFile) return;

    setLoading(true);
    setUploadStatus('Uploading video to shared volume...');
    
    const formData = new FormData();
    formData.append('video', videoFile);

    try {
      await axios.post(`${backendUrl}/api/reid/cameras/${selectedCameraId}/video`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadStatus('Video upload successful! Analyzing in background.');
      setVideoFile(null);
    } catch (error) {
      console.error(error);
      setUploadStatus('Failed to upload video.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Navigation tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveTab('list')}
          style={{
            flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontWeight: 'bold',
            background: activeTab === 'list' ? 'rgba(99,102,241,0.2)' : 'transparent',
            color: activeTab === 'list' ? '#818cf8' : '#94a3b8', cursor: 'pointer'
          }}
        >
          Cameras
        </button>
        <button 
          onClick={() => setActiveTab('add')}
          style={{
            flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontWeight: 'bold',
            background: activeTab === 'add' ? 'rgba(99,102,241,0.2)' : 'transparent',
            color: activeTab === 'add' ? '#818cf8' : '#94a3b8', cursor: 'pointer'
          }}
        >
          Add Camera
        </button>
        <button 
          onClick={() => setActiveTab('upload')}
          style={{
            flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontWeight: 'bold',
            background: activeTab === 'upload' ? 'rgba(99,102,241,0.2)' : 'transparent',
            color: activeTab === 'upload' ? '#818cf8' : '#94a3b8', cursor: 'pointer'
          }}
        >
          Ingest Video
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#94a3b8' }}>Registered Devices</h3>
            {cameras.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No cameras registered yet.</div>
            ) : (
              cameras.map(cam => (
                <div key={cam.id} className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{cam.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#94a3b8' }}>
                    <MapPin size={12} />
                    <span>{cam.locationName}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    <span>Detections: {cam._count?.detections || 0}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <form onSubmit={handleCreateCamera} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem', color: '#94a3b8' }}>Add New Camera</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Camera Name</label>
              <input 
                value={name} onChange={e => setName(e.target.value)} required
                style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'white' }}
                placeholder="e.g. Lobby Entrance"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Location Name</label>
              <input 
                value={locationName} onChange={e => setLocationName(e.target.value)} required
                style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'white' }}
                placeholder="e.g. Ground Floor East Wing"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Latitude</label>
                <input 
                  type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} required
                  style={{ width: '90%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'white' }}
                  placeholder="28.6139"
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Longitude</label>
                <input 
                  type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} required
                  style={{ width: '90%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'white' }}
                  placeholder="77.2090"
                />
              </div>
            </div>

            <button 
              type="submit" disabled={loading}
              style={{
                marginTop: '10px', padding: '12px', background: '#4f46e5', border: 'none', borderRadius: '6px',
                color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
              }}
            >
              <Plus size={16} /> Register Device
            </button>
          </form>
        )}

        {activeTab === 'upload' && (
          <form onSubmit={handleVideoUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem', color: '#94a3b8' }}>Ingest Video Logs</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Target Camera</label>
              <select 
                value={selectedCameraId} onChange={e => setSelectedCameraId(e.target.value)} required
                style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'white' }}
              >
                <option value="">-- Select camera source --</option>
                {cameras.map(cam => (
                  <option key={cam.id} value={cam.id}>{cam.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Select MP4 Video File</label>
              <input 
                type="file" accept="video/mp4" onChange={e => setVideoFile(e.target.files ? e.target.files[0] : null)} required
                style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'white' }}
              />
            </div>

            <button 
              type="submit" disabled={loading || !selectedCameraId || !videoFile}
              style={{
                marginTop: '10px', padding: '12px', background: '#10b981', border: 'none', borderRadius: '6px',
                color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
              }}
            >
              <Film size={16} /> Run Video Ingestion
            </button>

            {uploadStatus && (
              <div style={{ 
                marginTop: '12px', padding: '10px', borderRadius: '6px', fontSize: '0.8rem',
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc'
              }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <ShieldAlert size={14} />
                  <span>{uploadStatus}</span>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
