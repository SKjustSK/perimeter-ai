import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Camera } from '@/lib/api';

interface MapControllerProps {
  selectedCamera: Camera | null;
  cameras: Camera[];
}

function MapController({ selectedCamera, cameras }: MapControllerProps) {
  const map = useMap();

  // Handle selected camera centering
  useEffect(() => {
    if (selectedCamera) {
      map.setView([selectedCamera.latitude, selectedCamera.longitude], 16, {
        animate: true,
        duration: 0.8,
      });
    }
  }, [selectedCamera, map]);

  // Fit bounds to all cameras on initial load
  useEffect(() => {
    if (cameras.length > 0 && !selectedCamera) {
      const bounds = L.latLngBounds(cameras.map((c) => [c.latitude, c.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [cameras, map]);

  return null;
}

// Generate premium custom SVG marker matching Shadcn theme
const getCameraIcon = (isSelected: boolean) => {
  return new L.DivIcon({
    html: `
      <div class="flex items-center justify-center w-8 h-8 rounded-full border shadow-md hover:scale-110 transition-transform ${
        isSelected
          ? 'bg-primary border-primary text-primary-foreground'
          : 'bg-background border-border text-foreground hover:bg-accent'
      }">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </div>
    `,
    className: 'custom-camera-marker-wrapper',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

interface CameraMapProps {
  cameras: Camera[];
  selectedCamera: Camera | null;
  onSelectCamera: (camera: Camera | null) => void;
}

export function CameraMap({ cameras, selectedCamera, onSelectCamera }: CameraMapProps) {
  const defaultCenter: [number, number] = [40.7128, -74.0060]; // New York fallback

  return (
    <div className="w-full h-full min-h-[500px] bg-muted overflow-hidden z-0">
      <MapContainer
        center={defaultCenter}
        zoom={14}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {cameras.map((camera) => {
          const isSelected = selectedCamera?.id === camera.id;
          return (
            <Marker
              key={camera.id}
              position={[camera.latitude, camera.longitude]}
              icon={getCameraIcon(isSelected)}
              eventHandlers={{
                click: () => onSelectCamera(camera),
              }}
            >
              <Popup closeButton={false}>
                <div className="p-1 font-sans text-xs">
                  <p className="font-semibold text-foreground">{camera.name}</p>
                  <p className="text-muted-foreground mt-0.5">{camera.location}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                    Lat: {camera.latitude.toFixed(5)}, Lng: {camera.longitude.toFixed(5)}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <MapController selectedCamera={selectedCamera} cameras={cameras} />
      </MapContainer>
    </div>
  );
}

export default CameraMap;
