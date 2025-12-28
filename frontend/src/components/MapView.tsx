import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet + Vite
const createCameraIcon = (name: string, isMatch: boolean, matchIndex?: number) => {
  return L.divIcon({
    className: 'custom-icon',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${isMatch ? '#ef4444' : '#6366f1'};
        color: white;
        border: 2px solid white;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        font-weight: bold;
        font-size: 12px;
      ">
        ${isMatch && matchIndex !== undefined ? matchIndex + 1 : '📷'}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

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

interface MapViewProps {
  cameras: Camera[];
  matches: Match[];
}

const MapView: React.FC<MapViewProps> = ({ cameras, matches }) => {
  // Center map on the first camera, or a default coordinate
  const defaultCenter: [number, number] = cameras.length > 0 
    ? [cameras[0].latitude, cameras[0].longitude] 
    : [28.6139, 77.2090]; // Default New Delhi, India coordinates

  // Generate sequence line for tracking
  const trackingPath: [number, number][] = matches
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(m => [m.camera.latitude, m.camera.longitude]);

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Render all cameras */}
        {cameras.map(camera => {
          // Check if this camera is part of ReID search results
          const matchIndex = matches.findIndex(m => m.camera.id === camera.id);
          const isMatch = matchIndex !== -1;

          return (
            <Marker 
              key={camera.id} 
              position={[camera.latitude, camera.longitude]}
              icon={createCameraIcon(camera.name, isMatch, isMatch ? matchIndex : undefined)}
            >
              <Popup>
                <div style={{ color: '#111' }}>
                  <h3 style={{ margin: '0 0 5px 0' }}>{camera.name}</h3>
                  <p style={{ margin: 0 }}><strong>Location:</strong> {camera.locationName}</p>
                  {isMatch && (
                    <p style={{ margin: '5px 0 0 0', color: '#ef4444', fontWeight: 'bold' }}>
                      Matched in ReID path!
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Draw tracing lines of matched person sequentially */}
        {trackingPath.length > 1 && (
          <Polyline 
            positions={trackingPath} 
            color="#ef4444" 
            weight={4}
            dashArray="10, 10"
          />
        )}
      </MapContainer>
    </div>
  );
};

export default MapView;
