import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker, Tooltip } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { MapPin, Navigation } from 'lucide-react';

const customIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const robotIcon = new Icon({
  iconUrl: 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 50 60%22%3E%3Crect x=%225%22 y=%225%22 width=%2240%22 height=%2250%22 rx=%225%22 fill=%22%231e40af%22/%3E%3Crect x=%2210%22 y=%228%22 width=%2715%22 height=%2715%22 rx=%222%22 fill=%22%233b82f6%22/%3E%3Crect x=%2225%22 y=%228%22 width=%2715%22 height=%2715%22 rx=%222%22 fill=%22%233b82f6%22/%3E%3Ccircle cx=%2217.5%22 cy=%2215%22 r=%223%22 fill=%22%23fbbf24%22/%3E%3Ccircle cx=%2732.5%22 cy=%2215%22 r=%223%22 fill=%22%23fbbf24%22/%3E%3Crect x=%2715%22 y=%2728%22 width=%2720%22 height=%2218%22 fill=%22%233b82f6%22/%3E%3Crect x=%2220%22 y=%2232%22 width=%2710%22 height=%2714%22 fill=%22%231e40af%22/%3E%3C/svg%3E',
  iconSize: [40, 50],
  iconAnchor: [20, 50],
  popupAnchor: [0, -50],
  shadowSize: [40, 50]
});

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
}

interface CrackNotification {
  id: number;
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  latitude: number;
  longitude: number;
  depth?: number; // in millimeters
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

function RoutingControl({ from, to }: { from: [number, number] | null; to: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    if (!from || !map) return;

    const control = (L as any).Routing.control({
      waypoints: [
        L.latLng(from[0], from[1]),
        L.latLng(to[0], to[1])
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      lineOptions: {
        styles: [{ color: '#3b82f6', opacity: 0.8, weight: 5 }]
      }
    }).addTo(map);

    return () => {
      map.removeControl(control);
    };
  }, [map, from, to]);

  return null;
}

export function MapView() {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [robotLocation, setRobotLocation] = useState<Coordinates | null>({
    latitude: 51.505,
    longitude: -0.09,
    accuracy: 5,
    timestamp: new Date().toISOString(),
  });
  const [mapCenter, setMapCenter] = useState<[number, number]>([51.505, -0.09]);
  const [selectedCrackId, setSelectedCrackId] = useState<number | null>(null);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string>('');
  const [notifications, setNotifications] = useState<CrackNotification[]>([]);
  const [selectedCrackDetails, setSelectedCrackDetails] = useState<CrackNotification | null>(null);
  const [showRobotInput, setShowRobotInput] = useState(false);
  const [showRouting, setShowRouting] = useState(false);
  const [tempRobotLat, setTempRobotLat] = useState(robotLocation?.latitude.toString() || '');
  const [tempRobotLng, setTempRobotLng] = useState(robotLocation?.longitude.toString() || '');

  const saveCoordinates = async (lat: number, lng: number, accuracy?: number) => {
    try {
      await addDoc(collection(db, 'gps_coordinates'), {
        user_id: 'anonymous', // Placeholder for now
        latitude: lat,
        longitude: lng,
        accuracy: accuracy ?? null,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error saving coordinates:', error);
    }
  };

  const maybeDetectCrack = (lat: number, lng: number) => {
    if (Math.random() < 0.18) {
      const severity = Math.random() < 0.35 ? 'critical' : Math.random() < 0.5 ? 'warning' : 'info';
      const message = `Crack detected near ${lat.toFixed(5)}, ${lng.toFixed(5)} (severity: ${severity})`;
      const depth = Math.floor(Math.random() * 5) + 1; // 1-5mm
      const newAlert: CrackNotification = {
        id: Date.now(),
        message,
        timestamp: new Date().toLocaleString(),
        severity,
        latitude: lat,
        longitude: lng,
        depth,
      };
      setNotifications((prev) => [newAlert, ...prev].slice(0, 10));
    }
  };

  const updateRobotLocation = (lat: number, lng: number) => {
    const newRobotLoc: Coordinates = {
      latitude: lat,
      longitude: lng,
      accuracy: 3,
      timestamp: new Date().toISOString(),
    };
    setRobotLocation(newRobotLoc);
    setTempRobotLat(lat.toString());
    setTempRobotLng(lng.toString());
  };

  const getCurrentLocation = () => {
    setError('');
    setTracking(true);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setTracking(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newCoords = {
          latitude,
          longitude,
          accuracy,
          timestamp: new Date().toISOString(),
        };
        setCoordinates(newCoords);
        saveCoordinates(latitude, longitude, accuracy);
        maybeDetectCrack(latitude, longitude);
        setTracking(false);
      },
      (error) => {
        setError(`Error getting location: ${error.message}`);
        setTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  };

  const startTracking = () => {
    setError('');
    setTracking(true);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setTracking(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newCoords = {
          latitude,
          longitude,
          accuracy,
          timestamp: new Date().toISOString(),
        };
        setCoordinates(newCoords);
        setMapCenter([latitude, longitude]);
        setSelectedCrackId(null);
        saveCoordinates(latitude, longitude, accuracy);
        maybeDetectCrack(latitude, longitude);
      },
      (error) => {
        setError(`Error tracking location: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (coordinates && !selectedCrackDetails) {
      setMapCenter([coordinates.latitude, coordinates.longitude]);
    }
  }, [coordinates, selectedCrackDetails]);

  return (
    <div className="h-screen bg-gray-100 p-4 flex items-center justify-center overflow-auto">
      <div className="w-full max-w-6xl h-[85vh] grid grid-cols-[1.6fr_0.9fr] gap-4">
        <div className="bg-white rounded-2xl overflow-hidden shadow-lg flex flex-col">
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={getCurrentLocation}
                  disabled={tracking}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Navigation className="w-4 h-4" />
                  {tracking ? 'Getting Location...' : 'Get Current Location'}
                </button>

                <button
                  onClick={startTracking}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  Start Live Tracking
                </button>

                <button
                  onClick={() => {
                    if (coordinates) {
                      maybeDetectCrack(coordinates.latitude, coordinates.longitude);
                    }
                  }}
                  className="text-sm px-3 py-2 border rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Simulate Crack Alert
                </button>
              </div>

              {coordinates && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Your Loc - Lat:</span> {coordinates.latitude.toFixed(6)},{' '}
                  <span className="font-medium">Lng:</span> {coordinates.longitude.toFixed(6)}
                  {coordinates.accuracy && (
                    <span className="ml-2">
                      <span className="font-medium">Accuracy:</span> {coordinates.accuracy.toFixed(0)}m
                    </span>
                  )}
                </div>
              )}

              {robotLocation && (
                <div className="text-sm text-blue-600">
                  <span className="font-medium">🤖 Robot - Lat:</span> {robotLocation.latitude.toFixed(6)},{' '}
                  <span className="font-medium">Lng:</span> {robotLocation.longitude.toFixed(6)}
                  {robotLocation.accuracy && (
                    <span className="ml-2">
                      <span className="font-medium">Accuracy:</span> {robotLocation.accuracy.toFixed(0)}m
                    </span>
                  )}
                  <button
                    onClick={() => setShowRobotInput(!showRobotInput)}
                    className="ml-3 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                  >
                    {showRobotInput ? 'Cancel' : 'Update Robot'}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                {error}
              </div>
            )}

            {showRobotInput && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs font-semibold text-blue-700 mb-2">Update Robot Location</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Latitude"
                    value={tempRobotLat}
                    onChange={(e) => setTempRobotLat(e.target.value)}
                    className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="Longitude"
                    value={tempRobotLng}
                    onChange={(e) => setTempRobotLng(e.target.value)}
                    className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm"
                  />
                  <button
                    onClick={() => {
                      const lat = parseFloat(tempRobotLat);
                      const lng = parseFloat(tempRobotLng);
                      if (!isNaN(lat) && !isNaN(lng)) {
                        updateRobotLocation(lat, lng);
                        setShowRobotInput(false);
                      }
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 p-3 bg-slate-50 flex items-center justify-center">
            <div className="w-full h-full max-w-full max-h-full">
              <MapContainer
                center={mapCenter}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                className="rounded-xl"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {coordinates && (
                  <Marker position={[coordinates.latitude, coordinates.longitude]} icon={customIcon}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold mb-1">Current Location</p>
                        <p>Latitude: {coordinates.latitude.toFixed(6)}</p>
                        <p>Longitude: {coordinates.longitude.toFixed(6)}</p>
                        {coordinates.accuracy && (
                          <p>Accuracy: {coordinates.accuracy.toFixed(0)}m</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(coordinates.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {robotLocation && (
                  <>
                    <Marker position={[robotLocation.latitude, robotLocation.longitude]} icon={robotIcon}>
                      <Tooltip direction="top" offset={[0, -10]} permanent>
                        <div className="font-bold text-blue-700 text-sm">🤖 Robot</div>
                      </Tooltip>
                      <Popup>
                        <div className="text-sm bg-blue-50 p-2 rounded">
                          <p className="font-bold mb-2 text-blue-700 text-base">🤖 Inspection Robot</p>
                          <div className="space-y-1 text-blue-600">
                            <p><span className="font-semibold">Latitude:</span> {robotLocation.latitude.toFixed(6)}</p>
                            <p><span className="font-semibold">Longitude:</span> {robotLocation.longitude.toFixed(6)}</p>
                            {robotLocation.accuracy && (
                              <p><span className="font-semibold">Accuracy:</span> {robotLocation.accuracy.toFixed(0)}m</p>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-2 border-t border-blue-200 pt-1">
                            Updated: {new Date(robotLocation.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                    <CircleMarker
                      center={[robotLocation.latitude, robotLocation.longitude]}
                      radius={25}
                      pathOptions={{
                        color: '#1e40af',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.1,
                        weight: 2,
                        dashArray: '5, 5'
                      }}
                    />
                  </>
                )}

                {notifications.map((notification) => {
                  const isSelected = selectedCrackId === notification.id;
                  if (selectedCrackId !== null && !isSelected) return null;

                  return (
                    <CircleMarker
                      key={notification.id}
                      center={[notification.latitude, notification.longitude]}
                      radius={isSelected ? 15 : 10}
                      pathOptions={{
                        color:
                          notification.severity === 'critical'
                            ? '#dc2626'
                            : notification.severity === 'warning'
                            ? '#f59e0b'
                            : '#3b82f6',
                        fillColor:
                          notification.severity === 'critical'
                            ? '#fecaca'
                            : notification.severity === 'warning'
                            ? '#fef3c7'
                            : '#bfdbfe',
                        fillOpacity: isSelected ? 1 : 0.8,
                        weight: isSelected ? 4 : 2,
                      }}
                    >
                      <Popup>
                        <div className="text-xs">
                          <p className="font-semibold">Crack Location</p>
                          <p>{notification.message}</p>
                          <p className="text-gray-500">{notification.timestamp}</p>
                          <p className="font-semibold mt-2">Depth: {notification.depth}mm</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}

                {showRouting && selectedCrackDetails && coordinates && (
                  <RoutingControl
                    from={[coordinates.latitude, coordinates.longitude]}
                    to={[selectedCrackDetails.latitude, selectedCrackDetails.longitude]}
                  />
                )}

                <MapUpdater center={mapCenter} />
              </MapContainer>
            </div>
          </div>
        </div>

        <aside className="bg-white rounded-2xl shadow-lg p-4 flex flex-col overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-800">Inspection Alerts</h2>
          <p className="text-xs text-gray-500 mt-1">Crack detections will appear here.</p>
          <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-2">
            {notifications.length === 0 ? (
              <div className="text-sm text-gray-500">No alerts detected yet.</div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => {
                    setSelectedCrackId(notification.id);
                    setSelectedCrackDetails(notification);
                    setMapCenter([notification.latitude, notification.longitude]);
                    setShowRouting(true);
                  }}
                  className={`w-full text-left rounded-lg p-3 border transition-all duration-150 ${
                    notification.severity === 'critical'
                      ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                      : notification.severity === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                      : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                  } ${selectedCrackId === notification.id ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
                >
                  <div className="text-xs uppercase tracking-wide font-semibold">
                    {notification.severity}
                  </div>
                  <div className="text-sm mt-1">{notification.message}</div>
                  <div className="text-xs text-gray-500 mt-1">{notification.timestamp}</div>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>

      {selectedCrackDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Crack Details</h3>
              <button
                onClick={() => {
                  setSelectedCrackDetails(null);
                  setShowRouting(false);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className={`rounded-lg p-4 mb-4 ${
              selectedCrackDetails.severity === 'critical'
                ? 'bg-red-50 border-2 border-red-200'
                : selectedCrackDetails.severity === 'warning'
                ? 'bg-amber-50 border-2 border-amber-200'
                : 'bg-blue-50 border-2 border-blue-200'
            }`}>
              <p className="text-sm font-semibold uppercase text-gray-700 mb-2">
                {selectedCrackDetails.severity} Severity
              </p>
              <p className="text-sm text-gray-700 mb-4">{selectedCrackDetails.message}</p>
              
              {/* Semicircular Gauge Meter */}
              <div className="bg-white p-4 rounded border border-gray-200 mb-4">
                <p className="text-xs text-gray-500 font-semibold mb-3">DEPTH SEVERITY GAUGE</p>
                <div className="flex justify-center items-center mb-4">
                  <svg viewBox="0 0 240 140" className="w-64 h-40">
                    {/* Background circle */}
                    <defs>
                      <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="25%" stopColor="#eab308" />
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="75%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#7f1d1d" />
                      </linearGradient>
                    </defs>
                    {/* Gauge background arc */}
                    <path
                      d="M 20 120 A 100 100 0 0 1 220 120"
                      fill="none"
                      stroke="url(#gaugeGradient)"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                    {/* Gray outer arc */}
                    <path
                      d="M 20 120 A 100 100 0 0 1 220 120"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="2"
                      opacity="0.5"
                    />
                    {/* Needle */}
                    <g
                      transform={`rotate(${(selectedCrackDetails.depth ?? 0) * 18 - 90} 120 120)`}
                    >
                      <line x1="120" y1="120" x2="120" y2="30" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
                      <circle cx="120" cy="120" r="6" fill="#1f2937" />
                    </g>
                    {/* Center circle */}
                    <circle cx="120" cy="120" r="8" fill="#374151" />
                    {/* Value text */}
                    <text x="120" y="135" textAnchor="middle" className="text-2xl font-bold" fill="#1f2937" fontSize="20">
                      {selectedCrackDetails.depth ?? 'N/A'} mm
                    </text>
                  </svg>
                </div>
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-green-500 mb-1"></div>
                    <p className="font-semibold">1mm</p>
                    <p className="text-gray-500 text-xs">Good</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-yellow-400 mb-1"></div>
                    <p className="font-semibold">2mm</p>
                    <p className="text-gray-500 text-xs">Light</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-amber-500 mb-1"></div>
                    <p className="font-semibold">3mm</p>
                    <p className="text-gray-500 text-xs">Moderate</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-orange-500 mb-1"></div>
                    <p className="font-semibold">4mm</p>
                    <p className="text-gray-500 text-xs">Serious</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-red-600 mb-1"></div>
                    <p className="font-semibold">5mm</p>
                    <p className="text-gray-500 text-xs">Critical</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-2 rounded border border-gray-200">
                <p className="text-xs text-gray-500 font-semibold mb-1">LOCATION</p>
                <p className="text-xs text-gray-700">Lat: {selectedCrackDetails.latitude.toFixed(6)}</p>
                <p className="text-xs text-gray-700">Lng: {selectedCrackDetails.longitude.toFixed(6)}</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-center mb-3">
              Detected: {selectedCrackDetails.timestamp}
            </div>
            <button
              onClick={() => {
                setSelectedCrackDetails(null);
                setShowRouting(false);
              }}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
