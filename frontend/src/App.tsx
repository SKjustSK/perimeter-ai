import { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import SearchPanel from './components/SearchPanel';
import { ShieldAlert, Compass } from 'lucide-react';

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

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

function App() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [searchResults, setSearchResults] = useState<Match[]>([]);

  const fetchCameras = async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/cameras`);
      setCameras(response.data);
    } catch (error) {
      console.error('Failed to fetch cameras list:', error);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh',
      background: '#0b0f19', color: '#e2e8f0', overflow: 'hidden'
    }}>
      
      {/* Premium Header */}
      <header style={{
        padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(17, 24, 39, 0.7)', backdropFilter: 'blur(10px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ShieldAlert size={20} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.5px' }}>
              PERIMETER <span style={{ color: '#06b6d4' }}>AI</span>
            </h1>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Decoupled CCTV Multi-Camera Re-Identification Pipeline</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b' }}>
          <Compass size={14} />
          <span>Active Nodes: {cameras.length}</span>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '16px', gap: '16px' }}>
        
        {/* Left: Device registration and uploads */}
        <div style={{ width: '300px', height: '100%' }}>
          <Sidebar 
            cameras={cameras} 
            onCameraAdded={fetchCameras} 
            backendUrl={backendUrl}
          />
        </div>

        {/* Center: Geographic Map trace */}
        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <MapView 
            cameras={cameras} 
            matches={searchResults} 
          />
        </div>

        {/* Right: Person image search logs */}
        <div style={{ width: '320px', height: '100%' }}>
          <SearchPanel 
            onSearchResults={(results) => setSearchResults(results)} 
            backendUrl={backendUrl}
          />
        </div>

      </div>

    </div>
  );
}

export default App;
