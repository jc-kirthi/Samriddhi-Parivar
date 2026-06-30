import React, { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { useApp } from "../lib/AppContext";
import { CivicIssue } from "../types";
import { 
  MapPin, 
  AlertTriangle, 
  Plus, 
  Minus,
  Navigation, 
  Clock, 
  Activity, 
  Info,
  Layers,
  Flame,
  Search,
  X,
  Compass,
  TrendingUp,
  ChevronDown,
  ChevronUp
} from "lucide-react";

// Approximate real coordinates for major Bengaluru neighborhoods (Task 2c)
const NEIGHBORHOODS = [
  { name: "Yelahanka", lat: 13.1006, lng: 77.5963 },
  { name: "Hebbal", lat: 13.0354, lng: 77.5988 },
  { name: "Malleshwaram", lat: 13.0031, lng: 77.5696 },
  { name: "Rajajinagar", lat: 12.9882, lng: 77.5548 },
  { name: "Indiranagar", lat: 12.9719, lng: 77.6412 },
  { name: "Koramangala", lat: 12.9352, lng: 77.6244 },
  { name: "Jayanagar", lat: 12.9307, lng: 77.5833 },
  { name: "JP Nagar", lat: 12.9105, lng: 77.5857 },
  { name: "Bannerghatta Road", lat: 12.8961, lng: 77.5985 },
  { name: "Electronic City", lat: 12.8452, lng: 77.6602 },
  { name: "Whitefield", lat: 12.9698, lng: 77.7499 },
  { name: "Marathahalli", lat: 12.9562, lng: 77.6973 },
  { name: "HSR Layout", lat: 12.9121, lng: 77.6446 },
  { name: "BTM Layout", lat: 12.9166, lng: 77.6047 }
];

// Historical high-density civic report hotspots in Bengaluru
const HISTORICAL_HOTSPOTS = [
  { lat: 12.9716, lng: 77.5946, name: "MG Road Central Business District", urgency: "High", count: 24 },
  { lat: 12.9352, lng: 77.6245, name: "Koramangala Commercial Hub", urgency: "Critical", count: 38 },
  { lat: 12.9784, lng: 77.6408, name: "Indiranagar 100ft Rd Corridor", urgency: "High", count: 29 },
  { lat: 12.9698, lng: 77.7499, name: "Whitefield IT Sector Zone", urgency: "Critical", count: 35 },
  { lat: 12.9180, lng: 77.6101, name: "Silk Board Intersection Area", urgency: "Critical", count: 42 },
  { lat: 12.9279, lng: 77.5909, name: "Jayanagar Residential Block 4", urgency: "Medium", count: 18 },
  { lat: 12.9915, lng: 77.5712, name: "Malleshwaram Market Zone", urgency: "Medium", count: 15 },
  { lat: 13.0285, lng: 77.5896, name: "Hebbal Flyover Expressway", urgency: "High", count: 22 },
  { lat: 12.9601, lng: 77.5866, name: "Lalbagh West Gate Sector", urgency: "Low", count: 12 },
  { lat: 12.9565, lng: 77.7011, name: "Marathahalli Junction Corridor", urgency: "High", count: 31 },
  { lat: 12.9105, lng: 77.6450, name: "HSR Layout Sector 2 Ring Road", urgency: "High", count: 25 },
];

interface MapContainerProps {
  issues: CivicIssue[];
  onSelectIssue: (issue: CivicIssue) => void;
  onMapClickReport: (lat: number, lng: number) => void;
  selectedIssueId?: string;
}

export default function MapContainer({ 
  issues, 
  onSelectIssue, 
  onMapClickReport,
  selectedIssueId 
}: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [useGoogleMaps, setUseGoogleMaps] = useState(false);
  
  // Local state for the SVG fallback map and UI controls
  const [mapViewMode, setMapViewMode] = useState<"pins" | "heatmap">("pins");
  const [isClusteringEnabled, setIsClusteringEnabled] = useState(true);
  const [hoveredIssue, setHoveredIssue] = useState<CivicIssue | null>(null);
  const [hoveredHotspot, setHoveredHotspot] = useState<any | null>(null);
  const [clickLocation, setClickLocation] = useState<{ lat: number; lng: number; x: number; y: number } | null>(null);
  
  // Interactive zoom & pan states (SVG map)
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });

  // Geolocation & search states
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isNearMeFilterActive, setIsNearMeFilterActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAnalyticsCollapsed, setIsAnalyticsCollapsed] = useState(true);

  const { t } = useApp();
  const mapsApiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;

  // Custom coordinate calculation helpers (Task 2b: Expanded bounds)
  const minLat = 12.8300; // Electronic City (South)
  const maxLat = 13.1100; // Yelahanka (North)
  const minLng = 77.4600; // Rajajinagar/West Boundary
  const maxLng = 77.7600; // Whitefield (East)
  const width = 800;
  const height = 600;

  const latToY = (lat: number) => {
    return ((maxLat - lat) / (maxLat - minLat)) * height;
  };
  const lngToX = (lng: number) => {
    return ((lng - minLng) / (maxLng - minLng)) * width;
  };
  const yToLat = (y: number) => {
    return maxLat - (y / height) * (maxLat - minLat);
  };
  const xToLng = (x: number) => {
    return minLng + (x / width) * (maxLng - minLng);
  };

  // Helper formula to compute physical distance in meters
  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Dynamic filtering of issues based on geolocation toggle
  const displayedIssues = React.useMemo(() => {
    if (isNearMeFilterActive && userLocation) {
      return issues.filter(issue => {
        if (!issue) return false;
        const dist = getDistanceInMeters(userLocation.lat, userLocation.lng, issue.latitude, issue.longitude);
        return dist <= 2000; // 2km radius
      });
    }
    return issues;
  }, [issues, isNearMeFilterActive, userLocation]);

  // Dynamic grouping logic of closest neighborhood (Task 3d)
  const getClosestNeighborhood = (lat: number, lng: number) => {
    let closest = NEIGHBORHOODS[0];
    let minDist = Infinity;
    NEIGHBORHOODS.forEach((n) => {
      const dist = Math.sqrt(Math.pow(n.lat - lat, 2) + Math.pow(n.lng - lng, 2));
      if (dist < minDist) {
        minDist = dist;
        closest = n;
      }
    });
    return closest.name;
  };

  const activeAreas = React.useMemo(() => {
    const counts: Record<string, number> = {};
    issues.forEach((issue) => {
      if (!issue) return;
      const area = getClosestNeighborhood(issue.latitude, issue.longitude);
      counts[area] = (counts[area] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => {
        const matchingNb = NEIGHBORHOODS.find(n => n.name === name);
        return { 
          name, 
          count,
          lat: matchingNb?.lat || 12.9716,
          lng: matchingNb?.lng || 77.5946
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [issues]);

  // Marker Clustering implementation (Task 3a)
  const mapClusters = React.useMemo(() => {
    if (!isClusteringEnabled || mapViewMode !== "pins") {
      return displayedIssues.map(i => ({ center: { lat: i.latitude, lng: i.longitude }, issues: [i], id: i.id }));
    }
    
    // Clustering coordinate delta dynamically adjusted by zoom scale
    const clusterThreshold = 0.045 / (scale || 1);
    const results: { center: { lat: number; lng: number }; issues: CivicIssue[]; id: string }[] = [];
    
    displayedIssues.forEach((issue) => {
      if (!issue) return;
      const match = results.find(c => {
        const dist = Math.sqrt(
          Math.pow(c.center.lat - issue.latitude, 2) + 
          Math.pow(c.center.lng - issue.longitude, 2)
        );
        return dist < clusterThreshold;
      });
      
      if (match) {
        match.issues.push(issue);
        match.center.lat = match.issues.reduce((sum, i) => sum + i.latitude, 0) / match.issues.length;
        match.center.lng = match.issues.reduce((sum, i) => sum + i.longitude, 0) / match.issues.length;
      } else {
        results.push({
          center: { lat: issue.latitude, lng: issue.longitude },
          issues: [issue],
          id: issue.id
        });
      }
    });
    return results;
  }, [displayedIssues, isClusteringEnabled, scale, mapViewMode]);

  // Seamless navigation flying helper across both Google Maps and fallback SVG (Task 3b)
  const flyToCoordinates = (lat: number, lng: number, zoomLevel = 14) => {
    if (useGoogleMaps && googleMapRef.current) {
      googleMapRef.current.setCenter({ lat, lng });
      googleMapRef.current.setZoom(zoomLevel);
    } else {
      setScale(2.5);
      setPosition({
        x: width / 2 - lngToX(lng) * 2.5,
        y: height / 2 - latToY(lat) * 2.5
      });
    }
  };

  // Reset helper to Bengaluru Center (Task 2e)
  const handleResetView = () => {
    if (useGoogleMaps && googleMapRef.current) {
      googleMapRef.current.setCenter({ lat: 12.9716, lng: 77.5946 });
      googleMapRef.current.setZoom(11);
    } else {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
    setIsNearMeFilterActive(false);
  };

  // Browser Geolocation Quick Filter (Task 3c)
  const handleNearMeClick = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setIsNearMeFilterActive(true);
        setIsLocating(false);
        flyToCoordinates(coords.lat, coords.lng, 14);
      },
      (err) => {
        console.error("Geolocation failed:", err);
        setIsLocating(false);
        alert("Geolocation permission denied or unavailable. Falling back gracefully.");
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  // Attempt to initialize real Google Map if API key is provided
  useEffect(() => {
    if (!mapsApiKey || mapsApiKey === "MY_GOOGLE_MAPS_API_KEY" || !mapRef.current) {
      setUseGoogleMaps(false);
      return;
    }

    const loader = new Loader({
      apiKey: mapsApiKey,
      version: "weekly",
      libraries: ["places", "visualization"]
    });

    (loader as any).load().then((google: any) => {
      setGoogleMapsLoaded(true);
      setUseGoogleMaps(true);

      // Task 2a Center & Bounds Setup
      const center = userLocation || { lat: 12.9716, lng: 77.5946 };
      const map = new google.maps.Map(mapRef.current!, {
        center,
        zoom: isNearMeFilterActive ? 14 : 11,
        minZoom: 10,
        maxZoom: 18,
        draggable: true,
        scrollwheel: true,
        gestureHandling: "greedy",
        zoomControl: true,
        disableDefaultUI: false,
        styles: [
          {
            featureType: "administrative",
            elementType: "geometry",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "poi",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "road",
            elementType: "labels.icon",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "transit",
            stylers: [{ visibility: "off" }]
          }
        ]
      });

      googleMapRef.current = map;

      // Add click listener
      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          onMapClickReport(e.latLng.lat(), e.latLng.lng());
        }
      });

      // Render 2km transparent radius if active
      if (isNearMeFilterActive && userLocation) {
        new google.maps.Circle({
          strokeColor: "#3b82f6",
          strokeOpacity: 0.8,
          strokeWeight: 1.5,
          fillColor: "#3b82f6",
          fillOpacity: 0.12,
          map,
          center: userLocation,
          radius: 2000
        });
      }

      const googleMarkers: google.maps.Marker[] = [];
      let heatmapLayer: any = null;

      if (mapViewMode === "pins") {
        // Marker clustering implementation on live Google Maps
        mapClusters.forEach((cluster) => {
          if (cluster.issues.length === 1) {
            const issue = cluster.issues[0];
            let pinColor = "#059669"; 
            if (issue.status === "Reported") pinColor = "#EF4444";
            else if (issue.status === "Verified") pinColor = "#F59E0B";
            else if (issue.status === "In Progress") pinColor = "#3B82F6";

            const marker = new google.maps.Marker({
              position: { lat: issue.latitude, lng: issue.longitude },
              map,
              title: issue.title,
              icon: {
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                fillColor: pinColor,
                fillOpacity: 0.9,
                strokeWeight: 1.5,
                strokeColor: "#FFFFFF",
                scale: 6
              }
            });

            marker.addListener("click", () => {
              onSelectIssue(issue);
            });

            googleMarkers.push(marker);
          } else {
            // Render beautiful clustered counts as native SVG elements
            const count = cluster.issues.length;
            const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="#3b82f6" fill-opacity="0.9" stroke="#ffffff" stroke-width="2"/>
              <text x="18" y="22" font-family="Inter, sans-serif" font-size="11px" font-weight="900" fill="#ffffff" text-anchor="middle">${count}</text>
            </svg>`;

            const marker = new google.maps.Marker({
              position: cluster.center,
              map,
              icon: {
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`,
                scaledSize: new google.maps.Size(36, 36)
              }
            });

            marker.addListener("click", () => {
              map.setCenter(cluster.center);
              map.setZoom(map.getZoom() + 2);
            });

            googleMarkers.push(marker);
          }
        });
      } else {
        // HeatmapLayer Mode
        const heatmapData: any[] = [];
        displayedIssues.forEach((issue) => {
          if (!issue) return;
          heatmapData.push({
            location: new google.maps.LatLng(issue.latitude, issue.longitude),
            weight: issue.urgency === "Critical" ? 12 : issue.urgency === "High" ? 8 : issue.urgency === "Medium" ? 4 : 2
          });
        });

        HISTORICAL_HOTSPOTS.forEach((spot) => {
          heatmapData.push({
            location: new google.maps.LatLng(spot.lat, spot.lng),
            weight: spot.urgency === "Critical" ? 15 : spot.urgency === "High" ? 10 : spot.urgency === "Medium" ? 5 : 2
          });
        });

        heatmapLayer = new google.maps.visualization.HeatmapLayer({
          data: heatmapData,
          map: map,
          radius: 35,
          opacity: 0.85
        });
      }

      // Recenter on selected item
      if (selectedIssueId) {
        const selectedIssue = issues.find(i => i && i.id === selectedIssueId);
        if (selectedIssue) {
          map.setCenter({ lat: selectedIssue.latitude, lng: selectedIssue.longitude });
          map.setZoom(15);
        }
      }

    }).catch((err) => {
      console.error("Google Maps failed to load, falling back to beautiful SVG map.", err);
      setUseGoogleMaps(false);
    });
  }, [issues, selectedIssueId, mapsApiKey, mapViewMode, mapClusters, userLocation, isNearMeFilterActive]);

  // Fallback SVG Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setHasDragged(false);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    setMouseDownPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = Math.abs(e.clientX - mouseDownPos.x);
    const dy = Math.abs(e.clientY - mouseDownPos.y);
    if (dx > 5 || dy > 5) {
      setHasDragged(true);
    }
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    setIsDragging(false);
    if (!hasDragged) {
      const svgRect = e.currentTarget.getBoundingClientRect();
      const relativeX = ((e.clientX - svgRect.left) / svgRect.width) * width;
      const relativeY = ((e.clientY - svgRect.top) / svgRect.height) * height;

      const canvasX = (relativeX - position.x) / scale;
      const canvasY = (relativeY - position.y) / scale;

      const clampedX = Math.max(0, Math.min(width, canvasX));
      const clampedY = Math.max(0, Math.min(height, canvasY));

      const lat = parseFloat(yToLat(clampedY).toFixed(5));
      const lng = parseFloat(xToLng(clampedX).toFixed(5));

      setClickLocation({ lat, lng, x: clampedX, y: clampedY });
      onMapClickReport(lat, lng);
    }
  };

  // Suggestions search handlers
  const autocompleteSuggestions = searchQuery.trim() === ""
    ? []
    : NEIGHBORHOODS.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSelectSuggestion = (n: typeof NEIGHBORHOODS[0]) => {
    setSearchQuery(n.name);
    setShowSuggestions(false);
    flyToCoordinates(n.lat, n.lng, 14);
  };

  return (
    <div className="relative w-full h-full min-h-[500px] bg-slate-50 dark:bg-[#1a2129] border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-xs" id="map-container-wrapper">
      
      {/* Top Banner including Search-to-Fly Navigation (Task 3b) */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-white/95 dark:bg-[#20272f]/95 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-white/5 shadow-md" id="map-control-header">
        
        {/* Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-gray-800 dark:text-[#e8eaed]">{t("Bengaluru Civic Grid")}</h4>
            <p className="text-[10px] text-gray-400 dark:text-[#9aa3ad] font-medium">{t("Real-time community tracking & reporting")}</p>
          </div>
        </div>

        {/* Search-To-Fly Autocomplete Component */}
        <div className="relative flex-1 max-w-xs mx-0 md:mx-4 z-40">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-[#9aa3ad]" />
            <input
              type="text"
              placeholder="Search area (e.g. Koramangala)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 dark:bg-[#1a2129] text-xs font-semibold text-gray-700 dark:text-[#e8eaed] border border-gray-200 dark:border-white/5 rounded-xl focus:outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(""); setShowSuggestions(false); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete Suggestions Box */}
          {showSuggestions && autocompleteSuggestions.length > 0 && (
            <div className="absolute top-11 left-0 right-0 bg-white dark:bg-[#20272f] border border-gray-200 dark:border-white/8 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50">
              {autocompleteSuggestions.map((n, idx) => (
                <button
                  key={`suggest-${idx}`}
                  onClick={() => handleSelectSuggestion(n)}
                  className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/5 text-gray-700 dark:text-[#e8eaed] border-b border-gray-100 dark:border-white/4 last:border-0 flex items-center gap-2"
                >
                  <MapPin className="w-3 h-3 text-blue-500" />
                  <span>{n.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Controls Panel */}
        <div className="flex items-center justify-between sm:justify-end gap-3">
          
          {/* Near Me Quick GPS Button */}
          <button
            onClick={handleNearMeClick}
            disabled={isLocating}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isNearMeFilterActive 
                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
                : "bg-slate-50 dark:bg-[#1a2129] text-gray-600 dark:text-[#e8eaed] border-gray-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/5"
            }`}
            title="Filter Issues Near Me (2km)"
          >
            <Compass className={`w-3.5 h-3.5 ${isLocating ? "animate-spin text-blue-500" : ""}`} />
            <span className="hidden sm:inline">{isNearMeFilterActive ? "2km Filter Active" : "Near Me"}</span>
          </button>

          {/* Map View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-[#1a2129] rounded-xl border border-gray-200 dark:border-white/5" id="map-mode-toggle-group">
            <button
              onClick={() => setMapViewMode("pins")}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                mapViewMode === "pins"
                  ? "bg-white dark:bg-[#20272f] text-slate-950 dark:text-[#e8eaed] shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-[#9aa3ad] dark:hover:text-[#e8eaed]"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Pins</span>
            </button>
            <button
              onClick={() => setMapViewMode("heatmap")}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                mapViewMode === "heatmap"
                  ? "bg-rose-500 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:text-[#9aa3ad] dark:hover:text-[#e8eaed]"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Heatmap</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full ${
              useGoogleMaps ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
            }`}>
              {useGoogleMaps ? "Live Google Map" : "Vector Grid"}
            </span>
          </div>
        </div>
      </div>

      {/* Actual Map Node Container */}
      {useGoogleMaps ? (
        <div ref={mapRef} className="w-full h-full min-h-[500px]" id="google-map-node" />
      ) : (
        // Immersive custom SVG vector map of Bengaluru
        <div className="relative w-full h-full overflow-hidden select-none bg-[#f4f6f0] dark:bg-[#0f1419]" id="fallback-svg-map-container">
          <svg 
            viewBox={`0 0 ${width} ${height}`} 
            className="w-full h-full cursor-grab active:cursor-grabbing bg-transparent"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            id="fallback-map-svg"
          >
            {/* Everything inside panned and zoomed group */}
            <g transform={`translate(${position.x}, ${position.y}) scale(${scale})`}>
              {/* Grid System lines */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148, 163, 184, 0.08)" strokeWidth="0.5" />
                </pattern>
                
                {/* Fallback Vector Heat Radial gradients */}
                <radialGradient id="heat-critical" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.75" />
                  <stop offset="30%" stopColor="#f97316" stopOpacity="0.45" />
                  <stop offset="65%" stopColor="#eab308" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="heat-high" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.7" />
                  <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#f97316" strokeOpacity="0" />
                </radialGradient>
                <radialGradient id="heat-medium" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="heat-low" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                  <stop offset="50%" stopColor="#34d399" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Bengaluru Waterbodies: Ulsoor Lake / Sankey Tank */}
              <path 
                d="M 500,180 C 530,170 560,160 590,190 C 620,220 600,260 550,250 C 520,240 480,210 500,180 Z" 
                fill="rgba(147, 197, 253, 0.5)" 
                stroke="#93c5fd" 
                strokeWidth="1.5"
                className="opacity-90 animate-pulse"
              />
              <text x="515" y="215" fill="#3b82f6" className="text-[8px] font-mono tracking-widest font-semibold opacity-40 select-none pointer-events-none">ULSOOR LAKE</text>

              <path 
                d="M 150,110 C 170,105 185,115 190,130 C 180,145 160,150 145,140 C 135,130 140,115 150,110 Z" 
                fill="rgba(147, 197, 253, 0.4)" 
                stroke="#93c5fd" 
                strokeWidth="1"
                className="opacity-80"
              />
              <text x="145" y="125" fill="#3b82f6" className="text-[8px] font-mono opacity-40 select-none pointer-events-none">SANKEY TANK</text>

              {/* Cubbon Park & Lalbagh Zones */}
              <path 
                d="M 320,240 C 350,230 400,220 420,250 C 430,280 390,320 350,310 C 310,300 290,260 320,240 Z" 
                fill="rgba(220, 252, 231, 0.4)" 
                stroke="#bbf7d0" 
                strokeWidth="1.5"
                className="opacity-95"
              />
              <text x="345" y="275" fill="#15803d" className="text-[9px] font-bold opacity-60 select-none pointer-events-none">Cubbon Park</text>

              <path 
                d="M 330,460 C 360,450 410,460 400,490 C 390,520 340,530 310,510 C 290,490 300,470 330,460 Z" 
                fill="rgba(220, 252, 231, 0.4)" 
                stroke="#bbf7d0" 
                strokeWidth="1"
                className="opacity-95"
              />
              <text x="335" y="495" fill="#15803d" className="text-[9px] font-semibold opacity-65 select-none pointer-events-none">Lalbagh Gardens</text>

              {/* Major Ring Roads and Metro Lines */}
              <path d="M 0,50 Q 400,10 800,80" fill="none" stroke="rgba(148, 163, 184, 0.15)" strokeWidth="6" className="opacity-45" />
              <path d="M 0,290 L 800,290" fill="none" stroke="rgba(168, 85, 247, 0.2)" strokeWidth="4" className="opacity-85" />
              <text x="630" y="283" fill="#a855f7" className="text-[8px] font-mono font-bold opacity-40 select-none pointer-events-none">NAMMA METRO PURPLE LINE</text>

              {/* Task 2c: Dynamic Neighborhood Labels with Pointer-Events: none */}
              <g className="pointer-events-none select-none">
                {NEIGHBORHOODS.map((n, idx) => {
                  const cx = lngToX(n.lng);
                  const cy = latToY(n.lat);
                  return (
                    <g key={`neigh-lab-${idx}`}>
                      {/* Soft dark-mode aware drop shadows for typography */}
                      <text 
                        x={cx} 
                        y={cy} 
                        textAnchor="middle" 
                        className="text-[10px] font-bold fill-slate-400 dark:fill-[#6b7480] uppercase tracking-wider font-sans select-none"
                      >
                        {n.name}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* Render User GPS radius on fallback (Task 3c indicator) */}
              {isNearMeFilterActive && userLocation && (
                <g className="pointer-events-none">
                  <circle
                    cx={lngToX(userLocation.lng)}
                    cy={latToY(userLocation.lat)}
                    r={75} // Approximate scale of 2km on SVG
                    fill="rgba(59, 130, 246, 0.12)"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    strokeDasharray="4,2"
                  />
                  <circle
                    cx={lngToX(userLocation.lng)}
                    cy={latToY(userLocation.lat)}
                    r={8}
                    fill="#3b82f6"
                    className="animate-ping opacity-40"
                  />
                  <circle
                    cx={lngToX(userLocation.lng)}
                    cy={latToY(userLocation.lat)}
                    r={4}
                    fill="#3b82f6"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* Pins and Clusters mode (Task 3a) */}
              {mapViewMode === "pins" ? (
                mapClusters.map((cluster) => {
                  const cx = lngToX(cluster.center.lng);
                  const cy = latToY(cluster.center.lat);

                  if (cluster.issues.length === 1) {
                    const issue = cluster.issues[0];
                    const isSelected = selectedIssueId === issue.id;
                    const statusColor = getStatusColor(issue.status);

                    return (
                      <g 
                        key={issue.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIssue(issue);
                        }}
                        onMouseEnter={() => setHoveredIssue(issue)}
                        onMouseLeave={() => setHoveredIssue(null)}
                        className="cursor-pointer group"
                      >
                        {(issue.urgency === "Critical" || isSelected) && (
                          <circle 
                            cx={cx} 
                            cy={cy} 
                            r={isSelected ? 18 : 12} 
                            className={`animate-ping opacity-40 ${
                              issue.status === "Reported" ? "fill-rose-400" : 
                              issue.status === "Verified" ? "fill-amber-400" :
                              issue.status === "In Progress" ? "fill-sky-400" : "fill-emerald-400"
                            }`}
                          />
                        )}

                        <ellipse cx={cx} cy={cy + 1} rx="4" ry="1.5" className="fill-black/15" />

                        {/* Beautiful vector Pin shape */}
                        <g transform={`translate(${cx - 10}, ${cy - 20})`}>
                          <path 
                            d="M10,0 C4.48,0 0,4.48 0,10 C0,17.5 10,24 10,24 C10,24 20,17.5 20,10 C20,4.48 15.52,0 10,0 Z" 
                            className={`${statusColor} transition-all duration-300 ${
                              isSelected ? "scale-125 origin-bottom" : "group-hover:scale-110 origin-bottom"
                            }`}
                          />
                          <circle 
                            cx="10" 
                            cy="10" 
                            r="4" 
                            fill="#FFFFFF" 
                            className={`${isSelected ? "scale-110" : ""}`}
                          />
                        </g>
                      </g>
                    );
                  } else {
                    // Draw beautiful SVG clustered circle marker (Task 3a fallback)
                    const count = cluster.issues.length;
                    return (
                      <g
                        key={`cluster-${cluster.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          flyToCoordinates(cluster.center.lat, cluster.center.lng, scale + 1.5);
                        }}
                        className="cursor-pointer group"
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={18}
                          fill="#3b82f6"
                          fillOpacity="0.85"
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="transition-transform group-hover:scale-110"
                        />
                        <text
                          x={cx}
                          y={cy + 4}
                          textAnchor="middle"
                          fill="#ffffff"
                          className="text-[11px] font-black font-sans"
                        >
                          {count}
                        </text>
                      </g>
                    );
                  }
                })
              ) : (
                // Density heatmap layer fallback
                <g id="svg-heatmap-layer" className="pointer-events-none opacity-90 animate-fade-in">
                  {HISTORICAL_HOTSPOTS.map((spot, idx) => {
                    const cx = lngToX(spot.lng);
                    const cy = latToY(spot.lat);
                    const radius = spot.urgency === "Critical" ? 65 : spot.urgency === "High" ? 52 : spot.urgency === "Medium" ? 40 : 28;
                    const gradientId = spot.urgency === "Critical" ? "heat-critical" : spot.urgency === "High" ? "heat-high" : spot.urgency === "Medium" ? "heat-medium" : "heat-low";

                    return (
                      <g key={`hotspot-${idx}`} className="cursor-help pointer-events-auto" onMouseEnter={() => setHoveredHotspot(spot)} onMouseLeave={() => setHoveredHotspot(null)}>
                        <circle cx={cx} cy={cy} r={radius} fill={`url(#${gradientId})`} className="transition-all hover:scale-105" style={{ mixBlendMode: "multiply" }} />
                        <circle cx={cx} cy={cy} r={3.5} className="fill-red-500 stroke-white stroke-1 opacity-70 animate-pulse" />
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          </svg>

          {/* Floating Zoom and Navigation Panel (Task 2e Reset View integrated) */}
          <div className="absolute top-20 right-3 z-20 flex flex-col gap-1.5 bg-white/95 dark:bg-[#20272f]/95 backdrop-blur-md p-2 rounded-xl border border-gray-200 dark:border-white/5 shadow-lg" id="zoom-control-widget">
            <button 
              onClick={() => setScale(s => Math.min(s + 0.25, 4.0))}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-[#e8eaed] font-bold rounded-lg text-xs flex items-center justify-center cursor-pointer transition-colors border border-gray-200 dark:border-white/5 bg-white dark:bg-[#1a2129]"
              title="Zoom In"
            >
              <Plus className="w-4 h-4 text-slate-800 dark:text-white" />
            </button>
            <button 
              onClick={() => setScale(s => Math.max(s - 0.25, 0.5))}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-[#e8eaed] font-bold rounded-lg text-xs flex items-center justify-center cursor-pointer transition-colors border border-gray-200 dark:border-white/5 bg-white dark:bg-[#1a2129]"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4 text-slate-800 dark:text-white" />
            </button>
            
            {/* Reset to City View Button (Task 2e) */}
            <button 
              onClick={handleResetView}
              className="px-2 py-1.5 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 font-extrabold rounded-lg text-[9px] flex items-center justify-center cursor-pointer transition-all border border-blue-100 dark:border-white/5 uppercase tracking-wider bg-blue-50/50 dark:bg-[#1a2129]"
              title="Reset View to City"
            >
              Reset
            </button>
            
            <div className="h-[1px] bg-slate-100 dark:bg-white/5 my-1"></div>
            <div className="grid grid-cols-3 gap-0.5 w-16 mx-auto">
              <div></div>
              <button onClick={() => setPosition(p => ({ ...p, y: p.y + 40 }))} className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-600 dark:text-white flex justify-center cursor-pointer font-bold text-xs">▲</button>
              <div></div>
              <button onClick={() => setPosition(p => ({ ...p, x: p.x + 40 }))} className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-600 dark:text-white flex justify-center cursor-pointer font-bold text-xs">◀</button>
              <button onClick={() => setPosition({ x: 0, y: 0 })} className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-[9px] text-slate-400 flex justify-center items-center cursor-pointer font-bold text-xs">●</button>
              <button onClick={() => setPosition(p => ({ ...p, x: p.x - 40 }))} className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-600 dark:text-white flex justify-center cursor-pointer font-bold text-xs">▶</button>
              <div></div>
              <button onClick={() => setPosition(p => ({ ...p, y: p.y - 40 }))} className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-600 dark:text-white flex justify-center cursor-pointer font-bold text-xs">▼</button>
              <div></div>
            </div>
            <span className="text-[8px] font-mono text-center font-bold text-slate-400 mt-0.5">Scale: {Math.round(scale * 100)}%</span>
          </div>

          {/* Collapsible Mini Analytics Widget: Issue Density by Ward (Task 3d) */}
          <div className="absolute top-20 left-3 z-20 flex flex-col bg-white/95 dark:bg-[#20272f]/95 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg w-52 overflow-hidden transition-all duration-300">
            <button 
              onClick={() => setIsAnalyticsCollapsed(!isAnalyticsCollapsed)}
              className="px-3 py-2 flex items-center justify-between text-[10px] font-extrabold uppercase text-gray-700 dark:text-[#e8eaed] bg-slate-50 dark:bg-[#1a2129] border-b border-gray-100 dark:border-white/5"
            >
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                Active Wards
              </span>
              {isAnalyticsCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
            {!isAnalyticsCollapsed && (
              <div className="p-2 flex flex-col gap-1 text-[11px] font-medium max-h-48 overflow-y-auto">
                {activeAreas.length === 0 ? (
                  <span className="text-gray-400 p-2 text-center text-[10px]">No active data</span>
                ) : (
                  activeAreas.map((area, idx) => (
                    <button
                      key={`ward-${idx}`}
                      onClick={() => flyToCoordinates(area.lat, area.lng, 14)}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between text-gray-600 dark:text-[#9aa3ad]"
                    >
                      <span className="truncate max-w-[110px]">{area.name}</span>
                      <span className="font-mono text-[9px] bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-md font-bold">{area.count}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Floating Hover Information Card */}
          {hoveredIssue && (
            <div 
              className="absolute pointer-events-none p-3 bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-xl z-30 flex flex-col gap-1 w-52 text-xs border border-slate-800 animate-scale-up animate-fade-in"
              style={{
                left: `${Math.max(10, Math.min(lngToX(hoveredIssue.longitude) * scale + position.x + 15, width - 230))}px`,
                top: `${Math.max(10, Math.min(latToY(hoveredIssue.latitude) * scale + position.y - 40, height - 130))}px`
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`inline-block px-1.5 py-0.5 text-[8px] font-extrabold uppercase rounded-md tracking-wider ${
                  hoveredIssue.urgency === "Critical" ? "bg-rose-500 text-white" :
                  hoveredIssue.urgency === "High" ? "bg-amber-500 text-white" : "bg-slate-700 text-slate-300"
                }`}>
                  {hoveredIssue.urgency}
                </span>
                <span className="text-[9px] font-semibold text-slate-400 font-mono">
                  {hoveredIssue.category}
                </span>
              </div>
              <h5 className="font-bold text-slate-50 truncate mt-0.5">{hoveredIssue.title}</h5>
              <div className="flex items-center gap-1 text-[10px] text-slate-300 mt-1 font-medium truncate">
                <Navigation className="w-3 h-3 text-blue-400 shrink-0" />
                <span>{hoveredIssue.locationName}</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-1">
                <Clock className="w-2.5 h-2.5 shrink-0" />
                <span>Verifications: {hoveredIssue.verificationsCount}</span>
              </div>
            </div>
          )}

          {/* Floating Hover Hotspot Information Card */}
          {hoveredHotspot && (
            <div 
              className="absolute pointer-events-none p-3 bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-xl z-30 flex flex-col gap-1 w-52 text-xs border border-slate-800 animate-scale-up animate-fade-in"
              style={{
                left: `${Math.max(10, Math.min(lngToX(hoveredHotspot.lng) * scale + position.x + 15, width - 230))}px`,
                top: `${Math.max(10, Math.min(latToY(hoveredHotspot.lat) * scale + position.y - 40, height - 130))}px`
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="inline-block px-1.5 py-0.5 text-[8px] font-extrabold uppercase rounded-md tracking-wider bg-rose-500 text-white">
                  Historical Hotspot
                </span>
                <span className="text-[9px] font-semibold text-slate-400 font-mono">
                  {hoveredHotspot.urgency} Urgency
                </span>
              </div>
              <h5 className="font-bold text-slate-50 truncate mt-0.5">{hoveredHotspot.name}</h5>
              <div className="flex items-center gap-1 text-[10px] text-slate-300 mt-1 font-medium truncate">
                <Navigation className="w-3 h-3 text-blue-400 shrink-0" />
                <span>Bengaluru Region</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-slate-400 mt-1">
                <Clock className="w-2.5 h-2.5 shrink-0" />
                <span>Historical Reports: {hoveredHotspot.count} ticket(s)</span>
              </div>
            </div>
          )}

          {/* Legend widget */}
          <div className="absolute bottom-3 right-3 p-3 bg-white/95 dark:bg-[#20272f]/95 backdrop-blur-sm border border-gray-100 dark:border-white/5 rounded-xl shadow-md w-48 text-[11px] font-medium text-gray-500 flex flex-col gap-2" id="map-legend-card">
            <h5 className="text-[10px] font-bold text-gray-700 dark:text-[#e8eaed] uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              {mapViewMode === "pins" ? "Map Legend" : "Density Insights"}
            </h5>
            {mapViewMode === "pins" ? (
              <div className="grid grid-cols-2 gap-2 text-gray-500 dark:text-[#9aa3ad]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block border border-white dark:border-white/10 shadow-xs"></span>
                  <span>Reported</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block border border-white dark:border-white/10 shadow-xs"></span>
                  <span>Verified</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block border border-white dark:border-white/10 shadow-xs"></span>
                  <span>Repair Sched.</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-white dark:border-white/10 shadow-xs"></span>
                  <span>Resolved</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-gray-500 dark:text-[#9aa3ad]">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500 opacity-85 inline-block border border-white shadow-xs"></span>
                    <span>Critical Density</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-red-600">High</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-orange-500 opacity-85 inline-block border border-white shadow-xs"></span>
                    <span>High Density</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-orange-500">Medium</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-500 opacity-85 inline-block border border-white shadow-xs"></span>
                    <span>Medium Density</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-blue-500">Moderate</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 opacity-85 inline-block border border-white shadow-xs"></span>
                    <span>Low Density</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-emerald-600">Stable</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Issue colors for fallback status coding
const getStatusColor = (status: CivicIssue["status"]) => {
  switch (status) {
    case "Reported": return "fill-rose-500 stroke-rose-600 shadow-rose-200 text-rose-500 bg-rose-50 border-rose-200";
    case "Verified": return "fill-amber-500 stroke-amber-600 shadow-amber-200 text-amber-500 bg-amber-50 border-amber-200";
    case "In Progress": return "fill-sky-500 stroke-sky-600 shadow-sky-200 text-sky-500 bg-sky-50 border-sky-200";
    case "Resolved": return "fill-emerald-500 stroke-emerald-600 shadow-emerald-200 text-emerald-500 bg-emerald-50 border-emerald-200";
    case "Repair Scheduled": return "fill-indigo-500 stroke-indigo-600 shadow-indigo-200 text-indigo-500 bg-indigo-50 border-indigo-200";
    case "Fix Completed": return "fill-teal-500 stroke-teal-600 shadow-teal-200 text-teal-500 bg-teal-50 border-teal-200";
    default: return "fill-rose-500 stroke-rose-600 text-rose-500 bg-rose-50 border-rose-200";
  }
};
