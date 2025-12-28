import React, { useState } from 'react';
import axios from 'axios';
import { Upload, Search, User, MapPin, Calendar, Compass } from 'lucide-react';

interface Camera {
  id: string;
  name: string;
  locationName: string;
  latitude: number;
  longitude: number;
}

interface Match {
  id: string;
  timestamp: string;
  score: number;
  camera: Camera;
}

interface SearchPanelProps {
  onSearchResults: (matches: Match[]) => void;
  backendUrl: string;
}

const SearchPanel: React.FC<SearchPanelProps> = ({ onSearchResults, backendUrl }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [matchesList, setMatchesList] = useState<Match[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setError(null);
    }
  };

  const handleSearch = async () => {
    if (!file) {
      setError('Please select an image file first.');
      return;
    }

    setLoading(true);
    setError(null);
    setMatchesList([]);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await axios.post(`${backendUrl}/api/reid/search`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const matches: Match[] = response.data.matches || [];
      setMatchesList(matches);
      onSearchResults(matches);
      
      if (matches.length === 0) {
        setError('No matching targets found in the database.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to search target person.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <User size={20} /> Target Person ReID
      </h2>

      {/* Drop Zone */}
      <div 
        className="glass-card" 
        style={{ 
          border: '2px dashed rgba(99, 102, 241, 0.3)', 
          borderRadius: '8px', 
          padding: '24px', 
          textAlign: 'center', 
          cursor: 'pointer',
          position: 'relative'
        }}
      >
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileChange}
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            opacity: 0, 
            cursor: 'pointer' 
          }} 
        />
        {preview ? (
          <img 
            src={preview} 
            alt="Target preview" 
            style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '4px' }} 
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
            <Upload size={32} />
            <span>Click or Drag Reference Image</span>
          </div>
        )}
      </div>

      <button
        onClick={handleSearch}
        disabled={loading || !file}
        style={{
          width: '100%',
          marginTop: '16px',
          padding: '12px',
          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          opacity: (loading || !file) ? 0.6 : 1,
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
        }}
      >
        {loading ? 'Searching Vectors...' : (
          <>
            <Search size={18} /> Search Person
          </>
        )}
      </button>

      {error && (
        <div style={{ 
          marginTop: '16px', 
          padding: '10px', 
          borderRadius: '6px', 
          background: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid rgba(239, 68, 68, 0.3)', 
          color: '#fca5a5',
          fontSize: '0.85rem'
        }}>
          {error}
        </div>
      )}

      {/* Results logs */}
      {matchesList.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '1rem', color: '#94a3b8', margin: '0 0 12px 0' }}>Detections Tracking</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {matchesList.map((match, index) => (
              <div 
                key={match.id} 
                className="glass-card" 
                style={{ padding: '12px', borderLeft: '3px solid #ef4444' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold' }}>
                    Match #{index + 1}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Score: {(match.score * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px', color: '#cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Compass size={14} className="text-indigo-400" />
                    <span><strong>{match.camera.name}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} />
                    <span>{match.camera.locationName}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} />
                    <span>{new Date(match.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPanel;
