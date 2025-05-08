import {
  forwardRef,
  RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store";

import { LAYOUT_TEMPLATES } from "../store/layoutSlice";
import { MAP_STYLE_OPTIONS } from "../store/mapSlice";
import { selectSelectedZoom } from "../store/zoomSlice";

// Mapbox and react-map-gl
import { LngLatLike, Map as MapboxMap } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapComponent, {
  Layer,
  MapRef,
  Marker,
  NavigationControl,
  Source,
  ViewState,
} from "react-map-gl/mapbox";

// Recharts
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
} from "recharts";

// GeoJSON types
import {
  Feature,
  FeatureCollection,
  Point as GeoJSONPoint,
  Geometry,
  LineString,
} from "geojson";

// Internal Imports
import html2canvas from "html2canvas-pro";
import { markExportAsTriggered } from "../store/checkoutSlice";
import { PAPER_SIZES } from "../store/productSlice.ts";
import Activity from "../types/Activity";
import { exportPdf } from "../utils/pdfUtils";
import { calculateScale } from "../utils/zoomUtils";
import CustomMarkerContent from "./CustomMarkerContent.tsx";

// --- Constants ---
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const DEFAULT_CENTER: LngLatLike = [2.3522, 48.8566];
const DEFAULT_ZOOM = 5;
const MAX_FIT_BOUNDS_ZOOM = 17;

// --- Utility Functions ---
const calculateCombinedBBox = (
  featureCollection: FeatureCollection<LineString | GeoJSONPoint>
): [number, number, number, number] | undefined => {
  if (
    !featureCollection ||
    !featureCollection.features ||
    featureCollection.features.length === 0
  )
    return undefined;
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  let hasValidCoords = false;
  featureCollection.features.forEach(
    (feature: Feature<LineString | GeoJSONPoint>) => {
      const processCoords = (coords: number[][]) =>
        coords.forEach((c) => {
          if (
            Array.isArray(c) &&
            c.length >= 2 &&
            isFinite(c[0]) &&
            isFinite(c[1])
          ) {
            minLng = Math.min(minLng, c[0]);
            minLat = Math.min(minLat, c[1]);
            maxLng = Math.max(maxLng, c[0]);
            maxLat = Math.max(maxLat, c[1]);
            hasValidCoords = true;
          }
        });
      const processPointCoords = (c: number[]) => {
        if (
          Array.isArray(c) &&
          c.length >= 2 &&
          isFinite(c[0]) &&
          isFinite(c[1])
        ) {
          minLng = Math.min(minLng, c[0]);
          minLat = Math.min(minLat, c[1]);
          maxLng = Math.max(maxLng, c[0]);
          maxLat = Math.max(maxLat, c[1]);
          hasValidCoords = true;
        }
      };
      if (feature.geometry) {
        if (
          feature.geometry.type === "LineString" &&
          feature.geometry.coordinates
        )
          processCoords(feature.geometry.coordinates);
        else if (
          feature.geometry.type === "Point" &&
          feature.geometry.coordinates
        )
          processPointCoords(feature.geometry.coordinates);
      }
    }
  );
  if (!hasValidCoords) {
    console.warn("calculateCombinedBBox: No valid coords found.");
    return undefined;
  }
  const buffer = 0.001;
  if (Math.abs(maxLng - minLng) < buffer) {
    minLng -= buffer / 2;
    maxLng += buffer / 2;
  }
  if (Math.abs(maxLat - minLat) < buffer) {
    minLat -= buffer / 2;
    maxLat += buffer / 2;
  }
  return [minLng, minLat, maxLng, maxLat];
};

const formatDisplayDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
};

const formatDisplayDate = (dateString: string | undefined): string => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
};

// --- Component Props & Refs ---
interface EditorPreviewProps {
  // selectedZoom: ZoomLevel;
  // onExportStatusChange: (isExporting: boolean) => void;
  hideControls?: boolean;
}

export interface EditorPreviewRef {
  exportPdf: (isCheckout?: boolean) => Promise<void>;
  setPointPlacementMode: (
    enabled: boolean,
    callback: (coords: number[]) => void
  ) => void;
  generatePreviewImage: () => Promise<string | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  mapContainerRef: RefObject<HTMLDivElement | null>;
  mapInstanceRef: RefObject<MapboxMap | null>;
}

// --- EditorPreview Component ---
const EditorPreview = forwardRef<EditorPreviewRef, EditorPreviewProps>(
  ({ hideControls = false, ...props }, ref) => {
    const dispatch: AppDispatch = useDispatch();
    // --- Listen to orientation ---
    const orientation = useSelector(
      (state: RootState) => state.layout.orientation
    );
    // --- Listen to layout background ---
    const backgroundColor =
      useSelector((state: RootState) => state.layout.backgroundColor) || "#fff";
    // --- Refs ---
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapRef>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<MapboxMap | null>(null);
    const fitBoundsIdleListenerRef = useRef<(() => void) | null>(null);
    // Ref to track previous activity count
    const prevActiveActivitiesCountRef = useRef<number>(0);
    // --- State ---
    const [isMapReady, setIsMapReady] = useState(false);
    const [elevationData, setElevationData] = useState<
      { x: number; y: number }[]
    >([]);
    // State for controlling the viewport
    const [viewState, setViewState] = useState<Partial<ViewState>>({
      longitude: DEFAULT_CENTER[0],
      latitude: DEFAULT_CENTER[1],
      zoom: DEFAULT_ZOOM,
      pitch: 0, // Default pitch
      bearing: 0, // Default bearing
      padding: { top: 0, bottom: 0, left: 0, right: 0 }, // Default padding
    });
    // State for forcing map remount
    const [mapRenderKey, setMapRenderKey] = useState<number>(0);
    // --- Redux Selectors ---
    const points = useSelector((state: RootState) => state.points.points);
    const activeActivityIds = useSelector(
      (state: RootState) => state.activities.activeActivityIds
    );
    const activities = useSelector(
      (state: RootState) =>
        state.activities.activities as Activity[] | undefined
    );
    const labels = useSelector((state: RootState) => state.labels);
    const layout = useSelector((state: RootState) => state.layout);
    const mapStyleState = useSelector((state: RootState) => state.map);
    const traceStyle = useSelector((state: RootState) => state.trace);
    const profileStyle = useSelector((state: RootState) => state.profile);
    const product = useSelector((state: RootState) => state.product);
    const checkout = useSelector((state: RootState) => state.checkout);
    const selectedZoom = useSelector(selectSelectedZoom);
    const titleMargin = useSelector(
      (state: RootState) => state.labels.title.style?.marginTop
    );
    const descMargin = useSelector(
      (state: RootState) => state.labels.description.style?.marginTop
    );
    const chartHeight = useSelector(
      (state: RootState) => state.profile.chartHeight
    );

    // --- Derived State & Memos ---
    const activeActivities = useMemo(
      () =>
        Array.isArray(activities)
          ? activities.filter((activity) =>
              activeActivityIds.includes(activity.id)
            )
          : [],
      [activities, activeActivityIds]
    );
    const firstActiveActivity = useMemo(
      () => (activeActivities.length > 0 ? activeActivities[0] : null),
      [activeActivities]
    );
    const baseDimensions = useMemo(() => {
      const selectedSize = PAPER_SIZES.find(
        (s) => s.id === product.selectedPaperSizeId
      );
      return selectedSize
        ? { width: selectedSize.renderWidth, height: selectedSize.renderHeight }
        : { width: 850.32, height: 1202.48 };
    }, [product.selectedPaperSizeId]);
    const scale = useMemo(
      () => calculateScale(selectedZoom, baseDimensions),
      [selectedZoom, baseDimensions]
    );
    const scaledDimensions = useMemo(() => {
      const w = baseDimensions.width * scale;
      const h = baseDimensions.height * scale;
      return layout.orientation === "Portrait"
        ? { width: w, height: h }
        : { width: h, height: w };
    }, [baseDimensions, scale, layout.orientation]);
    const scaledPadding = useMemo(
      () => Math.min(scaledDimensions.width, scaledDimensions.height) * 0.05,
      [scaledDimensions]
    );

    // --- Scaled Margins ---
    const scaledMargins = useMemo(
      () => ({
        top: layout.margins.top * scale,
        right: layout.margins.right * scale,
        bottom: layout.margins.bottom * scale,
        left: layout.margins.left * scale,
      }),
      [layout.margins, scale]
    );

    // --- Scaled Text Styles (Applying fontWeight) ---
    const scaledTitleStyle = useMemo(
      (): React.CSSProperties => ({
        fontSize: `${labels.title.style.fontSize * scale}px`,
        color: labels.title.style.color,
        fontFamily: labels.title.style.fontFamily,
        fontWeight: labels.title.style.fontWeight, // Apply fontWeight directly
        fontStyle: labels.title.style.isItalic ? "italic" : "normal",
        textAlign: labels.title.style.textAlign,
        marginTop: `${labels.title.style.marginTop * scale}px`,
        marginBottom: `${labels.title.style.marginBottom * scale}px`,
        textTransform: labels.title.style.textTransform,
        lineHeight: 1.1,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }),
      [labels.title.style, scale]
    );

    const scaledDescriptionStyle = useMemo(
      (): React.CSSProperties => ({
        fontSize: `${labels.description.style.fontSize * scale}px`,
        color: labels.description.style.color,
        fontFamily: labels.description.style.fontFamily,
        fontWeight: labels.description.style.fontWeight, // Apply fontWeight directly
        fontStyle: labels.description.style.isItalic ? "italic" : "normal",
        textAlign: labels.description.style.textAlign,
        marginTop: `${labels.description.style.marginTop * scale}px`,
        marginBottom: `${labels.description.style.marginBottom * scale}px`,
        textTransform: labels.description.style.textTransform,
        lineHeight: 1.2,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }),
      [labels.description.style, scale]
    );

    // Apply fontWeight to stats as well
    const scaledStatStyle = useCallback(
      (stat: (typeof labels.stats)[0]): React.CSSProperties => ({
        fontSize: `${(stat.style?.fontSize || 16) * scale}px`,
        fontFamily: stat.style?.fontFamily || "Open Sans, sans-serif",
        fontWeight: stat.style?.fontWeight || 400,
        fontStyle: stat.style?.isItalic ? "italic" : "normal",
        color: stat.style?.color || "#333333", // Default color if not set in style
        textTransform: stat.style?.textTransform || "none",
      }),
      [scale]
    );

    // --- Gradient Definitions for Elevation Profile ---
    const elevationGradient = useMemo(() => {
      const color = profileStyle.color || "#000000"; // Fallback color
      const gradientId = `elevationGradient-${profileStyle.gradientLength}`;

      // Define gradient stops based on length
      let stopOffset = "60%"; // Default to Medium
      if (profileStyle.gradientLength === "S") {
        stopOffset = "30%";
      } else if (profileStyle.gradientLength === "L") {
        stopOffset = "90%";
      }

      // Use the hex string directly for SVG gradient stops
      const hexColor = color;

      const defs = (
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor={hexColor}
              stopOpacity={0.8}
            />
            <stop
              offset={stopOffset}
              stopColor={hexColor}
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
      );

      return { defs, gradientId };
    }, [profileStyle.color, profileStyle.gradientLength]);

    // *** DEBUGGING LOG ***
    useEffect(() => {
      if (points.length > 0) {
        const latestActivityId = activeActivityIds[0]; // Assume latest added is the first active one
        if (latestActivityId) {
          const pointsForLatestActivity = points.filter(
            (p) => p.activityId === latestActivityId
          );
        }
      }
    }, [points, activeActivityIds]); // Log when points or active IDs change

    const visiblePoints = useMemo(() => {
      // console.log("Calculating visible points..."); // Optional: uncomment for more verbose logging
      const filtered = points.filter((p) => {
        const isVisibleFlag = p.isVisible;
        const isActive = activeActivityIds.includes(p.activityId);
        const hasCoords = Array.isArray(p.coordinate);
        const hasEnoughCoords = hasCoords && p.coordinate!.length >= 2;
        const hasFiniteLng = hasEnoughCoords && isFinite(p.coordinate![0]);
        const hasFiniteLat = hasEnoughCoords && isFinite(p.coordinate![1]);
        const shouldDisplay =
          isVisibleFlag && isActive && hasFiniteLng && hasFiniteLat;
        /* // Optional: Log filtering details for specific points
          if (p.name === 'La Trinité' || p.name === 'Roubion') {
              console.log(`Filtering ${p.name}: isVisible=${isVisibleFlag}, isActive=${isActive}, hasCoords=${hasCoords}, hasEnough=${hasEnoughCoords}, finiteLng=${hasFiniteLng}, finiteLat=${hasFiniteLat} => Display: ${shouldDisplay}`);
          }
          */
        return shouldDisplay;
      });
      // console.log("Visible points calculated:", filtered.length);
      return filtered;
    }, [points, activeActivityIds]);

    // --- PDF Export ---
    const [isExporting, setIsExporting] = useState(false);
    const handleExportPdf = async (isCheckout: boolean = false) => {
      const map = mapRef.current?.getMap();

      if (!containerRef.current || !mapContainerRef.current || !map) {
        console.warn("Export PDF skipped: missing refs.");
        alert(
          "Erreur : Impossible d'accéder aux éléments nécessaires pour l'export."
        );
        return;
      }
      if (!map.isStyleLoaded()) {
        console.warn("Export PDF skipped: Map style not loaded yet.");
        alert(
          "La carte n'est pas encore prête. Veuillez patienter quelques instants et réessayer."
        );
        return;
      }
      if (isCheckout && !checkout.paymentSucceeded) {
        console.warn("Export PDF skipped: Payment not successful.");
        return;
      }
      console.log("Export PDF requested. Waiting for map idle event...");

      // Fonction pour déclencher l'exportation réelle
      let exportTriggered = false; // Flag pour éviter double déclenchement
      const triggerActualExport = async () => {
        if (exportTriggered) return;
        exportTriggered = true;
        clearTimeout(exportTimeout); // Annuler le timeout de secours
        console.log("Map is ready/idle. Starting actual PDF export process...");
        try {
          containerRef.current?.classList.add("is-exporting");
          setIsExporting(true);
          // Attendre que le DOM se mette à jour (sinon les boutons restent dans le PDF)
          await new Promise((res) => setTimeout(res, 120));
          await exportPdf(
            containerRef,
            mapContainerRef,
            mapRef as RefObject<MapboxMap | null>
          );
          if (isCheckout) {
            dispatch(markExportAsTriggered());
          }
        } catch (error) {
          console.error("Error during exportPdf call:", error);
          alert("Une erreur s'est produite lors de la génération du PDF.");
        } finally {
          containerRef.current?.classList.remove("is-exporting");
          setIsExporting(false);
          console.log("PDF export attempt finished.");
        }
      };

      // Timeout de secours au cas où 'idle' ne se déclenche jamais
      const exportTimeout = setTimeout(() => {
        console.warn(
          "Map idle event did not fire within 5 seconds. Forcing export attempt..."
        );
        triggerActualExport();
      }, 5000); // Délai de 5 secondes

      // Vérifier si la carte est déjà chargée/idle
      if (map.loaded()) {
        console.log(
          "Map already loaded. Triggering export almost immediately."
        );
        // Utiliser setTimeout 0 pour sortir de la pile d'appel actuelle
        setTimeout(triggerActualExport, 0);
      } else {
        console.log("Map not fully loaded yet. Setting up idle listener.");
        // Attendre l'événement idle avant d'exporter
        map.once("idle", triggerActualExport);
        // Déclencher un redimensionnement pour s'assurer que l'événement idle sera émis
        // Essayons un petit délai avant resize
        setTimeout(() => map.resize(), 50);
      }
    };

    // --- Effect to Trigger Export After Successful Payment ---
    useEffect(() => {
      if (
        checkout.paymentSucceeded &&
        !checkout.lastSuccessfulExportTriggered
      ) {
        console.log("Payment successful, triggering PDF export...");
        handleExportPdf(true);
      }
    }, [
      checkout.paymentSucceeded,
      checkout.lastSuccessfulExportTriggered,
      dispatch,
    ]); // Removed isExporting dependency

    // --- Map Callbacks & Effects ---
    const handleMapLoad = useCallback(() => {
      if (!mapRef.current) return;
      const map = mapRef.current.getMap();
      mapInstanceRef.current = map;
      map.getCanvas().style.cursor = "grab";
      map.on("mousedown", () => {
        if (mapInstanceRef.current)
          mapInstanceRef.current.getCanvas().style.cursor = "grabbing";
      });
      map.on("mouseup", () => {
        if (mapInstanceRef.current)
          mapInstanceRef.current.getCanvas().style.cursor = "grab";
      });
      // Apply pitch/bearing from viewState if different
      if (viewState.pitch !== undefined && viewState.pitch !== map.getPitch())
        map.setPitch(viewState.pitch);
      if (
        viewState.bearing !== undefined &&
        viewState.bearing !== map.getBearing()
      )
        map.setBearing(viewState.bearing);

      // Let Mapbox handle the event type implicitly for the callback
      // @ts-ignore - Ignoring persistent type error on map.once signature
      map.once(
        "idle",
        () => {
          // Reverted to simplest callback signature
          if (mapInstanceRef.current) {
            console.log("Map is idle. Resizing and setting ready.");
            mapInstanceRef.current.resize(); // Resize needed after load
            setIsMapReady(true);
            toggleMapLabels(mapInstanceRef.current, mapStyleState.showLabels);
            toggleMapTerrain(mapInstanceRef.current, mapStyleState.showTerrain);
          }
        },
        3000
      ); // Reduced timeout slightly? Test this value. Maybe 2000 or 2500?
      const readyTimeout = setTimeout(() => {
        if (!isMapReady && mapInstanceRef.current) {
          mapInstanceRef.current.resize();
          setIsMapReady(true);
          toggleMapLabels(mapInstanceRef.current, mapStyleState.showLabels);
          toggleMapTerrain(mapInstanceRef.current, mapStyleState.showTerrain);
          console.warn("Map idle timeout, forced ready.");
        }
      }, 1500); // Reduced timeout to 1.5 seconds
      map.once("idle", () => clearTimeout(readyTimeout));
    }, [
      isMapReady,
      mapStyleState.showLabels,
      mapStyleState.showTerrain,
      viewState.pitch,
      viewState.bearing,
    ]);

    // --- Effect for Map Style Changes (Update viewState too) ---
    useEffect(() => {
      const map = mapInstanceRef.current;
      if (!map || !isMapReady) return;
      // Update map instance directly
      if (map.getPitch() !== mapStyleState.pitch)
        map.setPitch(mapStyleState.pitch);
      if (map.getBearing() !== mapStyleState.bearing)
        map.setBearing(mapStyleState.bearing);
      toggleMapLabels(map, mapStyleState.showLabels);
      toggleMapTerrain(map, mapStyleState.showTerrain);
      // Also update the controlled viewState if style changes affect pitch/bearing
      setViewState((vs) => ({
        ...vs,
        pitch: mapStyleState.pitch,
        bearing: mapStyleState.bearing,
      }));
    }, [
      isMapReady,
      mapStyleState.pitch,
      mapStyleState.bearing,
      mapStyleState.showLabels,
      mapStyleState.showTerrain,
    ]);

    // --- Always sync label visibility after style change (Mapbox timing fix) ---
    useEffect(() => {
      const map = mapInstanceRef.current;
      if (!map || !isMapReady) return;
      const applyLabels = () => toggleMapLabels(map, mapStyleState.showLabels);
      map.on("styledata", applyLabels);
      map.on("idle", applyLabels);
      if (map.isStyleLoaded()) applyLabels();
      return () => {
        map.off("styledata", applyLabels);
        map.off("idle", applyLabels);
      };
    }, [mapStyleState.showLabels, mapStyleState.selectedStyleId, isMapReady]);

    // --- Label Toggling Function ---
    const toggleMapLabels = (map: MapboxMap | null, show: boolean) => {
      if (!map || !map.isStyleLoaded()) return;
      const style = map.getStyle();
      if (!style || !style.layers) return;
      style.layers.forEach((layer) => {
        if (layer.type === "symbol" && layer.layout?.["text-field"]) {
          const currentVisibility =
            map.getLayoutProperty(layer.id, "visibility") ?? "visible";
          const targetVisibility = show ? "visible" : "none";
          if (currentVisibility !== targetVisibility) {
            try {
              map.setLayoutProperty(layer.id, "visibility", targetVisibility);
            } catch (e) {
              console.warn(`Could not set visibility for layer ${layer.id}`, e);
            }
          }
        }
      });
    };

    // --- Terrain Toggling Function ---
    const toggleMapTerrain = (map: MapboxMap | null, show: boolean) => {
      if (!map || !map.isStyleLoaded()) return;
      const terrainSourceExists = map.getSource("mapbox-dem");
      if (show && terrainSourceExists) {
        if (!map.getTerrain()) {
          try {
            map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
          } catch (e) {
            console.warn("Failed to set terrain:", e);
          }
        }
      } else {
        if (map.getTerrain()) {
          try {
            map.setTerrain(null);
          } catch (e) {
            console.warn("Failed to remove terrain:", e);
          }
        }
      }
    };

    // --- Point Placement Mode ---
    // Initialize ref with null for proper type inference
    const clickListenerCallback = useRef<
      ((e: mapboxgl.MapMouseEvent) => void) | null
    >(null);
    const setPointPlacementMode = useCallback(
      (enabled: boolean, callback: (coords: number[]) => void) => {
        const map = mapInstanceRef.current;
        if (!map) return;
        // Remove existing listener before potentially adding a new one
        if (clickListenerCallback.current) {
          map.off("click", clickListenerCallback.current);
          clickListenerCallback.current = null; // Clear the ref
        }
        if (enabled) {
          map.getCanvas().style.cursor = "crosshair";
          // Define the new listener
          const newListener = (e: mapboxgl.MapMouseEvent) => {
            callback([e.lngLat.lng, e.lngLat.lat]);
          };
          // Attach the new listener and store it in the ref
          map.on("click", newListener);
          clickListenerCallback.current = newListener;
        } else {
          // Only reset cursor if we are disabling the mode
          map.getCanvas().style.cursor = "grab";
          // Listener is already removed and ref cleared at the beginning
        }
      },
      []
    );

    // --- Adjust Map Logic (accessible partout dans le composant) ---
    const adjustMapAsync = useCallback(async () => {
      const map = mapInstanceRef.current;
      if (!isMapReady || !map) return;
      const currentMap = map;
      console.log("Adjusting map: Resizing first...");
      await new Promise((resolve) => setTimeout(resolve, 50));
      // PATCH: Secure resize call
      if (
        currentMap &&
        typeof currentMap.resize === "function" &&
        currentMap.getContainer &&
        currentMap.getContainer()
      ) {
        currentMap.resize();
      } else {
        console.warn("Skip map.resize(): container or method missing");
      }
      console.log("Waiting for map idle after resize...");
      await new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          console.warn(
            "Map idle timeout after resize during adjustMap (500ms)."
          );
          resolve(null);
        }, 500);
        currentMap.once("idle", () => {
          clearTimeout(timeoutId);
          console.log("Map idle after resize, proceeding to fit bounds.");
          resolve(null);
        });
      });
      // 3. Calculer BBox et les features
      const featuresToFit = [];
      activeActivities.forEach((activity) => {
        activity.trace?.features?.forEach((f) => {
          if (
            f?.geometry?.type === "LineString" &&
            Array.isArray(f.geometry.coordinates) &&
            f.geometry.coordinates.length > 0
          ) {
            featuresToFit.push(f);
          }
        });
      });
      points.forEach((p) => {
        if (
          p.isVisible &&
          activeActivityIds.includes(p.activityId) &&
          Array.isArray(p.coordinate) &&
          p.coordinate.length >= 2 &&
          isFinite(p.coordinate[0]) &&
          isFinite(p.coordinate[1])
        ) {
          featuresToFit.push({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [p.coordinate[0], p.coordinate[1]],
            },
            properties: {},
          });
        }
      });
      if (featuresToFit.length > 0) {
        // Correction : fitBounds effectif
        const featureCollection = {
          type: "FeatureCollection",
          features: featuresToFit,
        };
        const bbox = calculateCombinedBBox(featureCollection);
        if (bbox) {
          // Padding dynamique selon orientation (portrait/landscape)
          const isPortrait = orientation === "Portrait";
          const padding = isPortrait
            ? { top: 80, bottom: 80, left: 60, right: 60 }
            : { top: 60, bottom: 60, left: 80, right: 80 };
          currentMap.fitBounds(
            [
              [bbox[0], bbox[1]],
              [bbox[2], bbox[3]],
            ],
            {
              padding,
              maxZoom: MAX_FIT_BOUNDS_ZOOM,
              duration: 400,
            }
          );
        }
      } else {
        currentMap.easeTo({
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          duration: 300,
        });
      }
      console.log("Map adjustment sequence finished.");
    }, [
      isMapReady,
      mapInstanceRef,
      activeActivities,
      points,
      activeActivityIds,
      orientation,
    ]);

    // --- Force Map Resize on Data Change ---
    useEffect(() => {
      adjustMapAsync();
      // Nettoyage global du hook si besoin
      return () => {};
    }, [
      layout.selectedLayoutId,
      layout.orientation, // Ajout de layout.orientation pour forcer le fit/zoom sur changement Portrait/Landscape
      selectedZoom,
      activeActivities,
      activeActivityIds,
      isMapReady,
      scaledMargins,
      points,
      orientation,
      profileStyle.isVisible,
      profileStyle.chartHeight,
      titleMargin,
      descMargin,
      baseDimensions, // Ajout de baseDimensions pour recalculer le fitBounds quand la taille du poster change
    ]);

    // --- Ajustement carte sur changement fontSize des labels ---
    useEffect(() => {
      adjustMapAsync();
    }, [
      labels.title.style.fontSize,
      labels.description.style.fontSize,
      ...labels.stats.map((s) => s.style?.fontSize),
    ]);

    // --- Elevation Data ---
    useEffect(() => {
      const activityForProfile = activeActivities.find(
        (act) =>
          act.trace?.features?.[0]?.geometry?.type === "LineString" &&
          act.trace.features[0].geometry.coordinates.length > 0
      );
      if (
        activityForProfile?.trace?.features?.[0]?.geometry?.type ===
        "LineString"
      ) {
        const coords =
          activityForProfile.trace.features[0].geometry.coordinates;
        const elevationPoints = coords.map((c, i) => ({
          x: i,
          y: Array.isArray(c) && c.length > 2 && isFinite(c[2]!) ? c[2]! : 0,
        }));
        setElevationData(elevationPoints);
      } else {
        setElevationData([]);
      }
    }, [activeActivities]); // Dependency

    // --- Recenter trace when chartHeight changes ---
    useEffect(() => {
      const map = mapInstanceRef.current;
      if (!map || !isMapReady) return;
      // Filtrer les points invalides (NaN, undefined, null)
      const coords = (points || [])
        .map((p) => [p.longitude, p.latitude])
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
      if (coords.length !== (points?.length || 0)) {
        console.warn(
          "Certains points du trace sont invalides et ont été ignorés pour fitBounds."
        );
      }
      if (coords.length >= 2) {
        let minLng = Math.min(...coords.map((c) => c[0]));
        let minLat = Math.min(...coords.map((c) => c[1]));
        let maxLng = Math.max(...coords.map((c) => c[0]));
        let maxLat = Math.max(...coords.map((c) => c[1]));
        if ([minLng, minLat, maxLng, maxLat].every(Number.isFinite)) {
          map.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            { padding: 40, animate: true, maxZoom: 17 }
          );
        } else {
          console.warn(
            "fitBounds annulé : bbox contient des valeurs non finies",
            minLng,
            minLat,
            maxLng,
            maxLat
          );
        }
      } else if (coords.length === 1) {
        map.flyTo({ center: coords[0], zoom: 15, animate: true });
      }
    }, [chartHeight, isMapReady, points]);

    // --- Secure chartHeight and scale for chart rendering ---
    const safeChartHeight = Number.isFinite(chartHeight) ? chartHeight : 80;
    const safeScale = Number.isFinite(scale) ? scale : 1;

    // Debug log
    console.log(
      "chartHeight",
      chartHeight,
      "scale",
      scale,
      "product.selectedPaperSizeId",
      product.selectedPaperSizeId
    );

    // --- Generate Preview Image --- NEW FUNCTION
    const generatePreviewImage = useCallback(
      async (): Promise<string | null> => {
        if (!containerRef.current) {
          console.error("generatePreviewImage: containerRef is not available.");
          return null;
        }

        const node = containerRef.current;
        node.classList.add("is-exporting");
        // Sauvegarde des styles originaux
        const prevTransform = node.style.transform;
        const prevZoom = node.style.zoom;
        const prevBackground = node.style.background;
        // Forcer le zoom/scale à 100% et le fond blanc
        node.style.transform = "scale(1)";
        node.style.zoom = "100%";
        node.style.background = layout.backgroundColor || "#fff";

        // --- DPI élevé comme export PDF ---
        const targetDpi = 300;
        const originalPixelRatio = window.devicePixelRatio;
        const calculatedPixelRatio = targetDpi / 96;
        Object.defineProperty(window, "devicePixelRatio", {
          value: calculatedPixelRatio,
          writable: true,
        });
        const scale = calculatedPixelRatio;

        const controls = Array.from(
          document.querySelectorAll(
            ".mapboxgl-ctrl-top-right, .mapboxgl-ctrl-bottom-right, .mapboxgl-ctrl"
          )
        ) as HTMLElement[];
        const previousDisplays = controls.map((el) => el.style.display);
        controls.forEach((el) => {
          el.style.display = "none";
        });

        try {
          const canvas = await html2canvas(node, {
            scale: scale,
            useCORS: true,
            allowTaint: true,
            logging: false,
          });
          // Optionnel : ici, tu pourrais remplacer la zone carte par le vrai canvas Mapbox
          const dataUrl = canvas.toDataURL("image/png");
          return dataUrl;
        } catch (error) {
          console.error(
            "generatePreviewImage: error generating preview image:",
            error
          );
          return null;
        } finally {
          controls.forEach((el, i) => {
            el.style.display = previousDisplays[i];
          });
          node.classList.remove("is-exporting");
          node.style.transform = prevTransform;
          node.style.zoom = prevZoom;
          node.style.background = prevBackground;
          // Restaure le devicePixelRatio d'origine
          Object.defineProperty(window, "devicePixelRatio", {
            value: originalPixelRatio,
            writable: true,
          });
        }
      }
    );

    // --- Expose Imperative Handles ---
    useImperativeHandle(ref, () => ({
      exportPdf: handleExportPdf,
      setPointPlacementMode,
      generatePreviewImage, // Exposer la fonction de génération d'aperçu
      // Exposer les refs nécessaires pour l'export externe
      containerRef: containerRef, // Ref du conteneur principal
      mapContainerRef: mapContainerRef, // Ref du conteneur de la carte
      mapInstanceRef: mapInstanceRef, // Ref de l'instance Mapbox
    }));

    // --- Calculate Stats for Display ---
    const displayStats = useMemo(() => {
      // --- NEW SIMPLIFIED LOGIC ---
      // Always return the stats exactly as they are in the Redux store.
      return labels.stats;
    }, [labels.stats]); // Dependency is only labels.stats now

    // --- Get Selected Layout Template ---
    const selectedLayoutTemplate = useMemo(
      () =>
        LAYOUT_TEMPLATES.find((lt) => lt.id === layout.selectedLayoutId) ||
        LAYOUT_TEMPLATES[0],
      [layout.selectedLayoutId]
    );

    // --- Get Selected Map Style URL ---
    const mapStyleUrl = useMemo(
      () =>
        MAP_STYLE_OPTIONS.find((ms) => ms.id === mapStyleState.selectedStyleId)
          ?.url || MAP_STYLE_OPTIONS[0].url,
      [mapStyleState.selectedStyleId]
    );

    // --- Bloquer le zoom navigateur sur Ctrl+roulette souris ---
    useEffect(() => {
      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey) {
          e.preventDefault();
        }
      };
      const node = containerRef.current;
      if (node) {
        node.addEventListener("wheel", handleWheel, { passive: false });
      }
      return () => {
        if (node) {
          node.removeEventListener("wheel", handleWheel);
        }
      };
    }, [containerRef]);

    // --- JSX ---
    const selectedStyleId = mapStyleState.selectedStyleId;
    const showTerrain = mapStyleState.showTerrain;
    const selectedStyleInfo = MAP_STYLE_OPTIONS.find(
      (s) => s.id === selectedStyleId
    );
    const is3D = showTerrain && selectedStyleInfo?.hasTerrain;

    return (
      <div
        ref={containerRef}
        className="max-w-full  mx-auto md:w-full shadow-lg overflow-hidden relative print-container"
        style={{
          width: scaledDimensions.width,
          height: scaledDimensions.height,
          background: backgroundColor,
          border: `${layout.border.thickness}px solid ${layout.border.color}`,
          paddingTop: `${scaledMargins.top}px`,
          paddingRight: `${scaledMargins.right}px`,
          paddingBottom: `${scaledMargins.bottom}px`,
          paddingLeft: `${scaledMargins.left}px`,
          boxSizing: "border-box",
          aspectRatio: scaledDimensions.width / scaledDimensions.height, // optional: keeps shape ratio
        }}
      >
        {/* Remove the Export Overlay section if it's commented out or not needed */}
        {/* {isExporting && (
        <div
          // ref={spinnerOverlayRef} <-- Ref n'existe plus
          className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50"
        >
          <Spinner /> <span className="ml-2 font-sans">Exporting PDF...</span>
        </div>
      )} */}
        {/* New Relative Container for Absolute Positioning */}
        <div className="relative w-full h-full">
          {/* Conditional Layout Rendering */}
          {layout.selectedLayoutId === "layout-1" ? (
            <>
              {/* Map Container (Fills Parent) */}
              <div
                ref={mapContainerRef}
                className="absolute inset-0 overflow-hidden"
              >
                <MapComponent
                  key={orientation}
                  ref={mapRef}
                  {...viewState}
                  onMove={(evt) => setViewState(evt.viewState)}
                  mapStyle={mapStyleUrl}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  attributionControl={false}
                  style={{ width: "100%", height: "100%" }}
                  onLoad={handleMapLoad}
                  preserveDrawingBuffer={true}
                  interactive={true}
                  dragRotate={is3D}
                  pitch={is3D ? viewState.pitch ?? 45 : 0}
                  bearing={is3D ? viewState.bearing ?? 0 : 0}
                >
                  {/* Contrôle de navigation (zoom + -) */}
                  {!(isExporting || hideControls) && (
                    <NavigationControl
                      position="top-right"
                      showCompass={is3D}
                      visualizePitch={is3D}
                    />
                  )}
                  {/* Render Traces and Markers */}
                  {isMapReady &&
                    activeActivities.map((activity) => {
                      if (
                        !activity.trace ||
                        activity.trace.type !== "FeatureCollection" ||
                        !Array.isArray(activity.trace.features) ||
                        activity.trace.features.length === 0
                      )
                        return null;
                      const traceData =
                        activity.trace as FeatureCollection<Geometry>;
                      let lineDasharray: number[] | undefined;
                      if (traceStyle.lineStyle === "dashed")
                        lineDasharray = [
                          traceStyle.width * 2,
                          traceStyle.width * 2,
                        ];
                      else if (traceStyle.lineStyle === "dotted")
                        lineDasharray = [
                          traceStyle.width * 0.1,
                          traceStyle.width * 1.5,
                        ];
                      return (
                        <Source
                          key={`trace-src-${activity.id}-l1`}
                          id={`trace-src-${activity.id}`}
                          type="geojson"
                          data={traceData}
                        >
                          <Layer
                            id={`trace-layer-${activity.id}`}
                            type="line"
                            source={`trace-src-${activity.id}`}
                            filter={["==", "$type", "LineString"]}
                            layout={{
                              "line-join": traceStyle.lineJoin,
                              "line-cap": traceStyle.lineCap,
                            }}
                            paint={{
                              "line-color": traceStyle.color,
                              "line-width": traceStyle.width,
                              "line-opacity": traceStyle.opacity,
                              ...(lineDasharray && {
                                "line-dasharray": lineDasharray,
                              }),
                            }}
                          />
                        </Source>
                      );
                    })}
                  {isMapReady &&
                    visiblePoints.map((point) => (
                      <Marker
                        key={`${point.id}-l1-marker`}
                        longitude={point.coordinate![0]}
                        latitude={point.coordinate![1]}
                        anchor="bottom"
                      >
                        <CustomMarkerContent
                          type={point.type}
                          text={point.name}
                          description={point.description}
                          shape={point.style.shape}
                          backgroundColor={point.style.color}
                          textColor={point.style.textColor}
                        />
                      </Marker>
                    ))}
                </MapComponent>
              </div>

              {/* Text Overlay (Top) */}
              <div
                className="absolute top-0 left-0 right-0 z-10 p-4" // Basic positioning
                style={{
                  // Use scaledMargins for padding inside the overlay
                  padding: `${scaledMargins.left / 2}px`, // Adjust as needed
                }}
              >
                {/* Title */}
                {labels.title.isVisible && (
                  <div
                    style={{
                      ...scaledTitleStyle,
                      textAlign: "left" /* Match original */,
                    }}
                    dangerouslySetInnerHTML={{ __html: labels.title.text }}
                  />
                )}
                {/* Description */}
                {labels.description.isVisible && (
                  <div
                    style={{
                      ...scaledDescriptionStyle,
                      textAlign: "left" /* Match original */,
                    }}
                    dangerouslySetInnerHTML={{
                      __html: labels.description.text,
                    }}
                  />
                )}
              </div>

              {/* Stats & Profile Overlay (Bottom) */}
              <div
                className="absolute bottom-0 right-0 z-10" // Position bottom-right
                style={{
                  // Mimic example: fixed width percentage, padding, background, border
                  width: "35%", // From example
                  backgroundColor: layout.backgroundColor, // Semi-transparent white background
                  border: `${2 * scale}px solid ${labels.title.style.color}`, // Use title color for border
                  padding: `${scaledMargins.left / 1.5}px`, // Adjust padding as needed
                  boxSizing: "border-box",
                  // Add some margin from the edge if needed
                  marginBottom: `${scaledMargins.bottom / 2}px`,
                  marginRight: `${scaledMargins.right / 2}px`,
                }}
              >
                {/* Stats */}
                {displayStats.length > 0 && (
                  <div
                    className="w-full flex flex-col mb-2"
                    style={{ marginBottom: `${scaledMargins.bottom / 10}px` }}
                  >
                    {displayStats.map((stat, index) => {
                      const statValue = stat.value;
                      return (
                        <div
                          key={index}
                          className="w-full flex items-center justify-between space-x-2 relative"
                        >
                          <span
                            style={{
                              ...scaledStatStyle(stat),
                              backgroundColor: layout.backgroundColor,
                              position: "relative",
                              display: "inline-block",
                              paddingRight: `${5 * scale}px`,
                              zIndex: 1,
                            }}
                          >
                            {" "}
                            {stat.label}{" "}
                          </span>
                          {/* Dotted line */}
                          <span
                            className="absolute left-0 right-0 top-1/2 border-b border-dotted border-gray-400"
                            style={{
                              borderColor: scaledStatStyle(stat).color,
                              transform: "translateY(-50%)",
                            }}
                          ></span>
                          <span
                            style={{
                              ...scaledStatStyle(stat),
                              backgroundColor: layout.backgroundColor,
                              position: "relative",
                              display: "inline-block",
                              paddingLeft: `${5 * scale}px`,
                              zIndex: 1,
                            }}
                          >
                            {" "}
                            {statValue}{" "}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Elevation Profile */}
                {profileStyle.isVisible && elevationData.length > 1 && (
                  <div
                    style={{
                      height: `${safeChartHeight * safeScale}px`,
                      width: "100%",
                      marginBottom: `${
                        20 * scale
                      }px` /* Add some space before stats */,
                    }}
                  >
                    <ResponsiveContainer>
                      {profileStyle.style === "area" ? (
                        <AreaChart
                          data={elevationData}
                          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                        >
                          {profileStyle.showGradientEffect &&
                            elevationGradient.defs}
                          <Area
                            type="monotone"
                            dataKey="y"
                            stroke="none"
                            fill={
                              profileStyle.showGradientEffect
                                ? `url(#${elevationGradient.gradientId})`
                                : profileStyle.color
                            }
                            fillOpacity={1}
                            isAnimationActive={true}
                          />
                        </AreaChart>
                      ) : (
                        <LineChart
                          data={elevationData}
                          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                        >
                          <Line
                            type="monotone"
                            dataKey="y"
                            stroke={profileStyle.color}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={true}
                          />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          ) : layout.selectedLayoutId === "layout-2" ? (
            // ----- Layout 2: Flex Column with Inner Border -----
            <div
              className="flex flex-col w-full h-full border"
              style={{
                borderColor: scaledTitleStyle.color, // Match example border color
                borderWidth: `${2 * scale}px`, // Scale border width
              }}
            >
              {/* Map Area (Takes remaining space) */}
              <div
                ref={mapContainerRef}
                className="flex-1 relative overflow-hidden"
                style={{ padding: `${scaledMargins.top / 1.5}px` }} // Inner padding/margin for map
              >
                <MapComponent
                  key={orientation}
                  ref={mapRef}
                  {...viewState}
                  onMove={(evt) => setViewState(evt.viewState)}
                  mapStyle={mapStyleUrl}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  attributionControl={false}
                  style={{ width: "100%", height: "100%" }}
                  onLoad={handleMapLoad}
                  preserveDrawingBuffer={true}
                  interactive={true}
                  dragRotate={is3D}
                  pitch={is3D ? viewState.pitch ?? 45 : 0}
                  bearing={is3D ? viewState.bearing ?? 0 : 0}
                >
                  {/* Contrôle de navigation (zoom + -) */}
                  {!(isExporting || hideControls) && (
                    <NavigationControl
                      position="top-right"
                      showCompass={is3D}
                      visualizePitch={is3D}
                    />
                  )}
                  {/* Render Traces and Markers (Common logic can be extracted) */}
                  {isMapReady &&
                    activeActivities.map((activity) => {
                      if (
                        !activity.trace ||
                        activity.trace.type !== "FeatureCollection" ||
                        !Array.isArray(activity.trace.features) ||
                        activity.trace.features.length === 0
                      )
                        return null;
                      const traceData =
                        activity.trace as FeatureCollection<Geometry>;
                      let lineDasharray: number[] | undefined;
                      if (traceStyle.lineStyle === "dashed")
                        lineDasharray = [
                          traceStyle.width * 2,
                          traceStyle.width * 2,
                        ];
                      else if (traceStyle.lineStyle === "dotted")
                        lineDasharray = [
                          traceStyle.width * 0.1,
                          traceStyle.width * 1.5,
                        ];
                      return (
                        <Source
                          key={`trace-src-${activity.id}-l2`}
                          id={`trace-src-${activity.id}`}
                          type="geojson"
                          data={traceData}
                        >
                          <Layer
                            id={`trace-layer-${activity.id}`}
                            type="line"
                            source={`trace-src-${activity.id}`}
                            filter={["==", "$type", "LineString"]}
                            layout={{
                              "line-join": traceStyle.lineJoin,
                              "line-cap": traceStyle.lineCap,
                            }}
                            paint={{
                              "line-color": traceStyle.color,
                              "line-width": traceStyle.width,
                              "line-opacity": traceStyle.opacity,
                              ...(lineDasharray && {
                                "line-dasharray": lineDasharray,
                              }),
                            }}
                          />
                        </Source>
                      );
                    })}
                  {isMapReady &&
                    visiblePoints.map((point) => (
                      <Marker
                        key={`${point.id}-l2-marker`}
                        longitude={point.coordinate![0]}
                        latitude={point.coordinate![1]}
                        anchor="bottom"
                      >
                        <CustomMarkerContent
                          type={point.type}
                          text={point.name}
                          description={point.description}
                          shape={point.style.shape}
                          backgroundColor={point.style.color}
                          textColor={point.style.textColor}
                        />
                      </Marker>
                    ))}
                </MapComponent>
              </div>

              {/* Bottom Area (Text, Stats, Profile) */}
              <div
                className="flex-none border-t"
                style={{
                  borderColor: scaledTitleStyle.color, // Match example border color
                  borderTopWidth: `${2 * scale}px`, // Scale border width
                }}
              >
                {/* Text Block */}
                <div
                  style={{
                    padding: `${scaledMargins.top / 1.5}px ${
                      scaledMargins.left / 1.5
                    }px`,
                  }}
                >
                  {labels.title.isVisible && (
                    <div
                      style={{
                        ...scaledTitleStyle,
                        textAlign: "left",
                        marginBottom: `${scaledMargins.bottom / 10}px`,
                      }}
                      dangerouslySetInnerHTML={{ __html: labels.title.text }}
                    />
                  )}
                  {labels.description.isVisible && (
                    <div
                      style={{ ...scaledDescriptionStyle, textAlign: "left" }}
                      dangerouslySetInnerHTML={{
                        __html: labels.description.text,
                      }}
                    />
                  )}
                </div>

                {/* Stats & Profile Block */}
                <div
                  style={{
                    borderTop: `${2 * scale}px solid ${scaledTitleStyle.color}`, // Scaled top border
                    padding: `${scaledMargins.top / 1.5}px ${
                      scaledMargins.left / 1.5
                    }px`,
                  }}
                >
                  {displayStats.length > 0 && (
                    <div
                      className="w-full flex flex-col mb-2"
                      style={{ marginBottom: `${scaledMargins.bottom / 2}px` }}
                    >
                      {displayStats.map((stat, index) => {
                        const statValue = stat.value;
                        return (
                          <div
                            key={index}
                            className="w-full flex items-center justify-between space-x-2"
                          >
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingRight: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {stat.label}{" "}
                            </span>
                            <span
                              className="flex-1 border-b border-dotted border-gray-400"
                              style={{
                                borderColor: scaledStatStyle(stat).color,
                              }}
                            ></span>
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingLeft: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {statValue}{" "}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {profileStyle.isVisible && elevationData.length > 1 && (
                    <div
                      style={{
                        height: `${safeChartHeight * safeScale}px`,
                        width: "100%",
                        marginBottom: `${20 * scale}px`,
                      }}
                    >
                      <ResponsiveContainer>
                        {profileStyle.style === "area" ? (
                          <AreaChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            {profileStyle.showGradientEffect &&
                              elevationGradient.defs}
                            <Area
                              type="monotone"
                              dataKey="y"
                              stroke="none"
                              fill={
                                profileStyle.showGradientEffect
                                  ? `url(#${elevationGradient.gradientId})`
                                  : profileStyle.color
                              }
                              fillOpacity={1}
                              isAnimationActive={true}
                            />
                          </AreaChart>
                        ) : (
                          <LineChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            <Line
                              type="monotone"
                              dataKey="y"
                              stroke={profileStyle.color}
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={true}
                            />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : layout.selectedLayoutId === "layout-3" ? (
            // ----- Layout 3: Flex Column, Top Text, Middle Map (bordered), Bottom Elevation/Stats -----
            <div className="flex flex-col h-full">
              {/* Top Text Block */}
              <div
                className="flex-none text-center"
                style={{ paddingBottom: `${1 * scale}px` }} // Scaled padding from example
              >
                {labels.title.isVisible && (
                  <div
                    style={{
                      ...scaledTitleStyle,
                    }}
                    dangerouslySetInnerHTML={{ __html: labels.title.text }}
                  />
                )}
                {labels.description.isVisible && (
                  <div
                    style={{
                      ...scaledDescriptionStyle,
                      marginBottom: `${34 * scale}px` /* Scaled margin */,
                    }}
                    dangerouslySetInnerHTML={{
                      __html: labels.description.text,
                    }}
                  />
                )}
              </div>

              {/* Map Area (Takes remaining space, includes inner border) */}
              <div className="flex-1 relative overflow-hidden">
                <div
                  ref={mapContainerRef}
                  className="absolute inset-0 border overflow-hidden" // Fill parent, add border
                  style={{
                    borderWidth: `${1.8 * scale}px`, // Scaled border width
                    borderColor: scaledTitleStyle.color, // Grey border from example
                  }}
                >
                  <MapComponent
                    key={orientation}
                    ref={mapRef}
                    {...viewState}
                    onMove={(evt) => setViewState(evt.viewState)}
                    mapStyle={mapStyleUrl}
                    mapboxAccessToken={MAPBOX_TOKEN}
                    attributionControl={false}
                    style={{ width: "100%", height: "100%" }}
                    onLoad={handleMapLoad}
                    preserveDrawingBuffer={true}
                    interactive={true}
                    dragRotate={is3D}
                    pitch={is3D ? viewState.pitch ?? 45 : 0}
                    bearing={is3D ? viewState.bearing ?? 0 : 0}
                  >
                    {/* Contrôle de navigation (zoom + -) */}
                    {!(isExporting || hideControls) && (
                      <NavigationControl
                        position="top-right"
                        showCompass={is3D}
                        visualizePitch={is3D}
                      />
                    )}
                    {/* Render Traces and Markers */}
                    {isMapReady &&
                      activeActivities.map((activity) => {
                        if (
                          !activity.trace ||
                          activity.trace.type !== "FeatureCollection" ||
                          !Array.isArray(activity.trace.features) ||
                          activity.trace.features.length === 0
                        )
                          return null;
                        const traceData =
                          activity.trace as FeatureCollection<Geometry>;
                        let lineDasharray: number[] | undefined;
                        if (traceStyle.lineStyle === "dashed")
                          lineDasharray = [
                            traceStyle.width * 2,
                            traceStyle.width * 2,
                          ];
                        else if (traceStyle.lineStyle === "dotted")
                          lineDasharray = [
                            traceStyle.width * 0.1,
                            traceStyle.width * 1.5,
                          ];
                        return (
                          <Source
                            key={`trace-src-${activity.id}-l3`}
                            id={`trace-src-${activity.id}`}
                            type="geojson"
                            data={traceData}
                          >
                            <Layer
                              id={`trace-layer-${activity.id}`}
                              type="line"
                              source={`trace-src-${activity.id}`}
                              filter={["==", "$type", "LineString"]}
                              layout={{
                                "line-join": traceStyle.lineJoin,
                                "line-cap": traceStyle.lineCap,
                              }}
                              paint={{
                                "line-color": traceStyle.color,
                                "line-width": traceStyle.width,
                                "line-opacity": traceStyle.opacity,
                                ...(lineDasharray && {
                                  "line-dasharray": lineDasharray,
                                }),
                              }}
                            />
                          </Source>
                        );
                      })}
                    {isMapReady &&
                      visiblePoints.map((point) => (
                        <Marker
                          key={`${point.id}-l3-marker`}
                          longitude={point.coordinate![0]}
                          latitude={point.coordinate![1]}
                          anchor="bottom"
                        >
                          <CustomMarkerContent
                            type={point.type}
                            text={point.name}
                            description={point.description}
                            shape={point.style.shape}
                            backgroundColor={point.style.color}
                            textColor={point.style.textColor}
                          />
                        </Marker>
                      ))}
                  </MapComponent>
                </div>
              </div>

              {/* Bottom Block (Elevation & Stats) */}
              <div
                className="flex-none"
                style={{ marginTop: `${30 * scale}px` }} // Scaled margin from example
              >
                {profileStyle.isVisible && elevationData.length > 1 && (
                  <div
                    style={{
                      height: `${safeChartHeight * safeScale}px`,
                      width: "100%",
                      marginBottom: `${
                        20 * scale
                      }px` /* Add some space before stats */,
                    }}
                  >
                    <ResponsiveContainer>
                      {profileStyle.style === "area" ? (
                        <AreaChart
                          data={elevationData}
                          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                        >
                          {profileStyle.showGradientEffect &&
                            elevationGradient.defs}
                          <Area
                            type="monotone"
                            dataKey="y"
                            stroke="none"
                            fill={
                              profileStyle.showGradientEffect
                                ? `url(#${elevationGradient.gradientId})`
                                : profileStyle.color
                            }
                            fillOpacity={1}
                            isAnimationActive={true}
                          />
                        </AreaChart>
                      ) : (
                        <LineChart
                          data={elevationData}
                          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                        >
                          <Line
                            type="monotone"
                            dataKey="y"
                            stroke={profileStyle.color}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={true}
                          />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
                {displayStats.length > 0 && (
                  <div className="w-full flex flex-col space-y-1">
                    {" "}
                    {/* Use space-y for vertical spacing */}
                    {displayStats.map((stat, index) => {
                      const statValue = stat.value;
                      return (
                        <div
                          key={index}
                          className="w-full flex items-center justify-between space-x-2 relative"
                        >
                          <span
                            style={{
                              ...scaledStatStyle(stat),
                              backgroundColor: layout.backgroundColor,
                              position: "relative",
                              display: "inline-block",
                              paddingRight: `${5 * scale}px`,
                              zIndex: 1,
                            }}
                          >
                            {" "}
                            {stat.label}{" "}
                          </span>
                          {/* Dotted line */}
                          <span
                            className="absolute left-0 right-0 top-1/2 border-b border-dotted border-gray-400"
                            style={{
                              borderColor: scaledStatStyle(stat).color,
                              transform: "translateY(-50%)",
                            }}
                          ></span>
                          <span
                            style={{
                              ...scaledStatStyle(stat),
                              backgroundColor: layout.backgroundColor,
                              position: "relative",
                              display: "inline-block",
                              paddingLeft: `${5 * scale}px`,
                              zIndex: 1,
                            }}
                          >
                            {" "}
                            {statValue}{" "}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : layout.selectedLayoutId === "layout-4" ? (
            <div className="flex flex-col h-full">
              {/* Map Area (Takes most space, includes inner border) */}
              <div className="flex-1 relative overflow-hidden">
                <div
                  ref={mapContainerRef}
                  className="absolute inset-0 border overflow-hidden" // Fill parent, add border
                  style={{
                    borderWidth: `${1.8 * scale}px`, // Scaled border width from example
                    borderColor: scaledTitleStyle.color, // Grey border from example
                  }}
                >
                  <MapComponent
                    key={orientation}
                    ref={mapRef}
                    {...viewState}
                    onMove={(evt) => setViewState(evt.viewState)}
                    mapStyle={mapStyleUrl}
                    mapboxAccessToken={MAPBOX_TOKEN}
                    attributionControl={false}
                    style={{ width: "100%", height: "100%" }}
                    onLoad={handleMapLoad}
                    preserveDrawingBuffer={true}
                    interactive={true}
                    dragRotate={is3D}
                    pitch={is3D ? viewState.pitch ?? 45 : 0}
                    bearing={is3D ? viewState.bearing ?? 0 : 0}
                  >
                    {/* Contrôle de navigation (zoom + -) */}
                    {!(isExporting || hideControls) && (
                      <NavigationControl
                        position="top-right"
                        showCompass={is3D}
                        visualizePitch={is3D}
                      />
                    )}
                    {/* Render Traces and Markers */}
                    {isMapReady &&
                      activeActivities.map((activity) => {
                        if (
                          !activity.trace ||
                          activity.trace.type !== "FeatureCollection" ||
                          !Array.isArray(activity.trace.features) ||
                          activity.trace.features.length === 0
                        )
                          return null;
                        const traceData =
                          activity.trace as FeatureCollection<Geometry>;
                        let lineDasharray: number[] | undefined;
                        if (traceStyle.lineStyle === "dashed")
                          lineDasharray = [
                            traceStyle.width * 2,
                            traceStyle.width * 2,
                          ];
                        else if (traceStyle.lineStyle === "dotted")
                          lineDasharray = [
                            traceStyle.width * 0.1,
                            traceStyle.width * 1.5,
                          ];
                        return (
                          <Source
                            key={`trace-src-${activity.id}-l4`}
                            id={`trace-src-${activity.id}`}
                            type="geojson"
                            data={traceData}
                          >
                            <Layer
                              id={`trace-layer-${activity.id}`}
                              type="line"
                              source={`trace-src-${activity.id}`}
                              filter={["==", "$type", "LineString"]}
                              layout={{
                                "line-join": traceStyle.lineJoin,
                                "line-cap": traceStyle.lineCap,
                              }}
                              paint={{
                                "line-color": traceStyle.color,
                                "line-width": traceStyle.width,
                                "line-opacity": traceStyle.opacity,
                                ...(lineDasharray && {
                                  "line-dasharray": lineDasharray,
                                }),
                              }}
                            />
                          </Source>
                        );
                      })}
                    {isMapReady &&
                      visiblePoints.map((point) => (
                        <Marker
                          key={`${point.id}-l4-marker`}
                          longitude={point.coordinate![0]}
                          latitude={point.coordinate![1]}
                          anchor="bottom"
                        >
                          <CustomMarkerContent
                            type={point.type}
                            text={point.name}
                            description={point.description}
                            shape={point.style.shape}
                            backgroundColor={point.style.color}
                            textColor={point.style.textColor}
                          />
                        </Marker>
                      ))}
                  </MapComponent>
                </div>
                {/* Centered Text Overlay */}
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <div className="text-center">
                    {labels.title.isVisible && (
                      <div
                        style={{
                          ...scaledTitleStyle,
                          marginBottom: `${1 * scale}px` /* Scaled margin */,
                        }}
                        dangerouslySetInnerHTML={{ __html: labels.title.text }}
                      />
                    )}
                    {labels.description.isVisible && (
                      <div
                        style={{ ...scaledDescriptionStyle }}
                        dangerouslySetInnerHTML={{
                          __html: labels.description.text,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Block (Elevation & Stats) */}
              <div
                className="flex-none"
                style={{ marginTop: `${20 * scale}px` }} // Scaled margin from example
              >
                {profileStyle.isVisible && elevationData.length > 1 && (
                  <div
                    style={{
                      height: `${safeChartHeight * safeScale}px`,
                      width: "100%",
                      marginBottom: `${20 * scale}px`,
                    }}
                  >
                    <ResponsiveContainer>
                      {profileStyle.style === "area" ? (
                        <AreaChart
                          data={elevationData}
                          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                        >
                          {profileStyle.showGradientEffect &&
                            elevationGradient.defs}
                          <Area
                            type="monotone"
                            dataKey="y"
                            stroke="none"
                            fill={
                              profileStyle.showGradientEffect
                                ? `url(#${elevationGradient.gradientId})`
                                : profileStyle.color
                            }
                            fillOpacity={1}
                            isAnimationActive={true}
                          />
                        </AreaChart>
                      ) : (
                        <LineChart
                          data={elevationData}
                          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                        >
                          <Line
                            type="monotone"
                            dataKey="y"
                            stroke={profileStyle.color}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={true}
                          />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
                {displayStats.length > 0 && (
                  <div className="w-full flex flex-col space-y-1">
                    {displayStats.map((stat, index) => {
                      const statValue = stat.value;
                      return (
                        <div
                          key={index}
                          className="w-full flex items-center justify-between space-x-2 relative"
                        >
                          {/* Use white background to hide line behind text */}
                          <span
                            style={{
                              ...scaledStatStyle(stat),
                              backgroundColor: layout.backgroundColor,
                              position: "relative",
                              display: "inline-block",
                              paddingRight: `${5 * scale}px`,
                              zIndex: 1,
                            }}
                          >
                            {" "}
                            {stat.label}{" "}
                          </span>
                          <span
                            className="absolute left-0 right-0 top-1/2 border-b border-dotted border-gray-400"
                            style={{
                              borderColor: scaledStatStyle(stat).color,
                              transform: "translateY(-50%)",
                            }}
                          ></span>
                          <span
                            style={{
                              ...scaledStatStyle(stat),
                              backgroundColor: layout.backgroundColor,
                              position: "relative",
                              display: "inline-block",
                              paddingLeft: `${5 * scale}px`,
                              zIndex: 1,
                            }}
                          >
                            {" "}
                            {statValue}{" "}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : layout.selectedLayoutId === "layout-5" ? (
            <>
              {/* Map Container (Fills Parent) */}
              <div
                ref={mapContainerRef}
                className="absolute inset-0 overflow-hidden" // Map takes the whole area inside padding
              >
                <MapComponent
                  key={orientation}
                  ref={mapRef}
                  {...viewState}
                  onMove={(evt) => setViewState(evt.viewState)}
                  mapStyle={mapStyleUrl}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  attributionControl={false}
                  style={{ width: "100%", height: "100%" }}
                  onLoad={handleMapLoad}
                  preserveDrawingBuffer={true}
                  interactive={true}
                  dragRotate={is3D}
                  pitch={is3D ? viewState.pitch ?? 45 : 0}
                  bearing={is3D ? viewState.bearing ?? 0 : 0}
                >
                  {/* Contrôle de navigation (zoom + -) */}
                  {!(isExporting || hideControls) && (
                    <NavigationControl
                      position="top-right"
                      showCompass={is3D}
                      visualizePitch={is3D}
                    />
                  )}
                  {/* Render Traces and Markers */}
                  {isMapReady &&
                    activeActivities.map((activity) => {
                      if (
                        !activity.trace ||
                        activity.trace.type !== "FeatureCollection" ||
                        !Array.isArray(activity.trace.features) ||
                        activity.trace.features.length === 0
                      )
                        return null;
                      const traceData =
                        activity.trace as FeatureCollection<Geometry>;
                      let lineDasharray: number[] | undefined;
                      if (traceStyle.lineStyle === "dashed")
                        lineDasharray = [
                          traceStyle.width * 2,
                          traceStyle.width * 2,
                        ];
                      else if (traceStyle.lineStyle === "dotted")
                        lineDasharray = [
                          traceStyle.width * 0.1,
                          traceStyle.width * 1.5,
                        ];
                      return (
                        <Source
                          key={`trace-src-${activity.id}-l5`}
                          id={`trace-src-${activity.id}`}
                          type="geojson"
                          data={traceData}
                        >
                          <Layer
                            id={`trace-layer-${activity.id}`}
                            type="line"
                            source={`trace-src-${activity.id}`}
                            filter={["==", "$type", "LineString"]}
                            layout={{
                              "line-join": traceStyle.lineJoin,
                              "line-cap": traceStyle.lineCap,
                            }}
                            paint={{
                              "line-color": traceStyle.color,
                              "line-width": traceStyle.width,
                              "line-opacity": traceStyle.opacity,
                              ...(lineDasharray && {
                                "line-dasharray": lineDasharray,
                              }),
                            }}
                          />
                        </Source>
                      );
                    })}
                  {isMapReady &&
                    visiblePoints.map((point) => (
                      <Marker
                        key={`${point.id}-l5-marker`}
                        longitude={point.coordinate![0]}
                        latitude={point.coordinate![1]}
                        anchor="bottom"
                      >
                        <CustomMarkerContent
                          type={point.type}
                          text={point.name}
                          description={point.description}
                          shape={point.style.shape}
                          backgroundColor={point.style.color}
                          textColor={point.style.textColor}
                        />
                      </Marker>
                    ))}
                </MapComponent>
              </div>

              {/* Top-Left Content Overlay Block */}
              <div
                className="absolute z-10" // White background
                style={{
                  top: `${28 * scale}px`, // Scaled position from example
                  left: `${28 * scale}px`, // Scaled position from example
                  width: "35%", // Width from example
                  borderWidth: "0px",
                  backgroundColor: layout.backgroundColor,
                  boxSizing: "border-box",
                }}
              >
                {/* Top Section: Title & Description */}
                <div style={{ padding: `${28 * scale}px` }}>
                  {" "}
                  {/* Scaled padding */}
                  {labels.title.isVisible && (
                    <div
                      style={{
                        ...scaledTitleStyle,
                        textAlign: "left",
                        marginBottom: `${1 * scale}px`,
                      }}
                      dangerouslySetInnerHTML={{ __html: labels.title.text }}
                    />
                  )}
                  {labels.description.isVisible && (
                    <div
                      style={{ ...scaledDescriptionStyle, textAlign: "left" }}
                      dangerouslySetInnerHTML={{
                        __html: labels.description.text,
                      }}
                    />
                  )}
                </div>

                {/* Bottom Section: Elevation & Stats (with top border) */}
                <div
                  style={{
                    borderTop: `${1 * scale}px solid ${scaledTitleStyle.color}`, // Scaled top border
                    padding: `${28 * scale}px`, // Scaled padding
                  }}
                >
                  {profileStyle.isVisible && elevationData.length > 1 && (
                    <div
                      style={{
                        height: `${safeChartHeight * safeScale}px`,
                        width: "100%",
                        marginBottom: `${18 * scale}px` /* Scaled margin */,
                      }}
                    >
                      <ResponsiveContainer>
                        {profileStyle.style === "area" ? (
                          <AreaChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            {profileStyle.showGradientEffect &&
                              elevationGradient.defs}
                            <Area
                              type="monotone"
                              dataKey="y"
                              stroke="none"
                              fill={
                                profileStyle.showGradientEffect
                                  ? `url(#${elevationGradient.gradientId})`
                                  : profileStyle.color
                              }
                              fillOpacity={1}
                              isAnimationActive={true}
                            />
                          </AreaChart>
                        ) : (
                          <LineChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            <Line
                              type="monotone"
                              dataKey="y"
                              stroke={profileStyle.color}
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={true}
                            />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}
                  {displayStats.length > 0 && (
                    <div className="w-full flex flex-col space-y-1">
                      {displayStats.map((stat, index) => {
                        const statValue = stat.value;
                        return (
                          <div
                            key={index}
                            className="w-full flex items-center justify-between space-x-2 relative"
                          >
                            {/* Use white background to hide line behind text */}
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingRight: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {stat.label}{" "}
                            </span>
                            <span
                              className="absolute left-0 right-0 top-1/2 border-b border-dotted border-gray-400"
                              style={{
                                borderColor: scaledStatStyle(stat).color,
                                transform: "translateY(-50%)",
                              }}
                            ></span>
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingLeft: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {statValue}{" "}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : layout.selectedLayoutId === "layout-6" ? (
            <>
              {/* Map Container (Fills Parent) */}
              <div
                ref={mapContainerRef}
                className="absolute inset-0 overflow-hidden" // Map takes the whole area inside padding
              >
                <MapComponent
                  key={orientation}
                  ref={mapRef}
                  {...viewState}
                  onMove={(evt) => setViewState(evt.viewState)}
                  mapStyle={mapStyleUrl}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  attributionControl={false}
                  style={{ width: "100%", height: "100%" }}
                  onLoad={handleMapLoad}
                  preserveDrawingBuffer={true}
                  interactive={true}
                  dragRotate={is3D}
                  pitch={is3D ? viewState.pitch ?? 45 : 0}
                  bearing={is3D ? viewState.bearing ?? 0 : 0}
                >
                  {/* Contrôle de navigation (zoom + -) */}
                  {!(isExporting || hideControls) && (
                    <NavigationControl
                      position="top-right"
                      showCompass={is3D}
                      visualizePitch={is3D}
                    />
                  )}
                  {/* Render Traces and Markers */}
                  {isMapReady &&
                    activeActivities.map((activity) => {
                      if (
                        !activity.trace ||
                        activity.trace.type !== "FeatureCollection" ||
                        !Array.isArray(activity.trace.features) ||
                        activity.trace.features.length === 0
                      )
                        return null;
                      const traceData =
                        activity.trace as FeatureCollection<Geometry>;
                      let lineDasharray: number[] | undefined;
                      if (traceStyle.lineStyle === "dashed")
                        lineDasharray = [
                          traceStyle.width * 2,
                          traceStyle.width * 2,
                        ];
                      else if (traceStyle.lineStyle === "dotted")
                        lineDasharray = [
                          traceStyle.width * 0.1,
                          traceStyle.width * 1.5,
                        ];
                      return (
                        <Source
                          key={`trace-src-${activity.id}-l6`}
                          id={`trace-src-${activity.id}`}
                          type="geojson"
                          data={traceData}
                        >
                          <Layer
                            id={`trace-layer-${activity.id}`}
                            type="line"
                            source={`trace-src-${activity.id}`}
                            filter={["==", "$type", "LineString"]}
                            layout={{
                              "line-join": traceStyle.lineJoin,
                              "line-cap": traceStyle.lineCap,
                            }}
                            paint={{
                              "line-color": traceStyle.color,
                              "line-width": traceStyle.width,
                              "line-opacity": traceStyle.opacity,
                              ...(lineDasharray && {
                                "line-dasharray": lineDasharray,
                              }),
                            }}
                          />
                        </Source>
                      );
                    })}
                  {isMapReady &&
                    visiblePoints.map((point) => (
                      <Marker
                        key={`${point.id}-l6-marker`}
                        longitude={point.coordinate![0]}
                        latitude={point.coordinate![1]}
                        anchor="bottom"
                      >
                        <CustomMarkerContent
                          type={point.type}
                          text={point.name}
                          description={point.description}
                          shape={point.style.shape}
                          backgroundColor={point.style.color}
                          textColor={point.style.textColor}
                        />
                      </Marker>
                    ))}
                </MapComponent>
              </div>

              {/* Bottom Content Overlay Block */}
              <div
                className="absolute z-10" // White background
                style={{
                  bottom: `${40 * scale}px`, // Scaled position from example
                  left: `${40 * scale}px`, // Scaled position from example
                  right: `${40 * scale}px`, // Scaled position from example
                  borderWidth: "0px",
                  boxSizing: "border-box",
                  backgroundColor: layout.backgroundColor,
                }}
              >
                {/* Top Section: Title & Description */}
                <div style={{ padding: `${28 * scale}px` }}>
                  {" "}
                  {/* Scaled padding */}
                  {labels.title.isVisible && (
                    <div
                      style={{
                        ...scaledTitleStyle,
                        textAlign: "left",
                        marginBottom: `${34 * scale}px`,
                      }}
                      dangerouslySetInnerHTML={{ __html: labels.title.text }}
                    />
                  )}
                  {labels.description.isVisible && (
                    <div
                      style={{ ...scaledDescriptionStyle, textAlign: "left" }}
                      dangerouslySetInnerHTML={{
                        __html: labels.description.text,
                      }}
                    />
                  )}
                </div>

                {/* Bottom Section: Elevation & Stats (with top border) */}
                <div
                  style={{
                    borderTop: `${1 * scale}px solid ${scaledTitleStyle.color}`, // Scaled top border
                    padding: `${28 * scale}px`, // Scaled padding
                  }}
                >
                  {profileStyle.isVisible && elevationData.length > 1 && (
                    <div
                      style={{
                        height: `${safeChartHeight * safeScale}px`,
                        width: "100%",
                        marginBottom: `${8 * scale}px` /* Scaled margin */,
                      }}
                    >
                      <ResponsiveContainer>
                        {profileStyle.style === "area" ? (
                          <AreaChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            {profileStyle.showGradientEffect &&
                              elevationGradient.defs}
                            <Area
                              type="monotone"
                              dataKey="y"
                              stroke="none"
                              fill={
                                profileStyle.showGradientEffect
                                  ? `url(#${elevationGradient.gradientId})`
                                  : profileStyle.color
                              }
                              fillOpacity={1}
                              isAnimationActive={true}
                            />
                          </AreaChart>
                        ) : (
                          <LineChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            <Line
                              type="monotone"
                              dataKey="y"
                              stroke={profileStyle.color}
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={true}
                            />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}
                  {displayStats.length > 0 && (
                    <div className="w-full flex flex-col space-y-1">
                      {displayStats.map((stat, index) => {
                        const statValue = stat.value;
                        return (
                          <div
                            key={index}
                            className="w-full flex items-center justify-between space-x-2 relative"
                          >
                            {/* Use white background to hide line behind text */}
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingRight: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {stat.label}{" "}
                            </span>
                            <span
                              className="absolute left-0 right-0 top-1/2 border-b border-dotted border-gray-400"
                              style={{
                                borderColor: scaledStatStyle(stat).color,
                                transform: "translateY(-50%)",
                              }}
                            ></span>
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingLeft: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {statValue}{" "}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : layout.selectedLayoutId === "layout-7" ? (
            <div className="flex h-full">
              {" "}
              {/* Main flex container */}
              {/* Left Column (Vertical Text) */}
              <div
                className="flex-none relative" // Fixed width, relative for text positioning
                style={{
                  width: `${175.59 * scale}px`,
                  marginRight: `${1 * scale}px`,
                }}
              >
                {/* Description (Rendered first in DOM, appears above Title due to rotation) */}
                <div
                  className="absolute bottom-0 left-0 transform -rotate-90 origin-top-left whitespace-nowrap text-right"
                  style={{
                    width: `calc(100% + ${
                      90.6271 * scale
                    }px)` /* Keep height logic like layout-7 */,
                  }}
                >
                  {/* Description (Rendered first in DOM, appears above Title due to rotation) */}
                  {labels.description.isVisible && (
                    <div
                      style={{
                        ...scaledDescriptionStyle,
                        marginBottom: `${34 * scale}px`,
                        textAlign: "right",
                      }}
                      dangerouslySetInnerHTML={{
                        __html: labels.description.text,
                      }}
                    />
                  )}
                  {/* Title */}
                  {labels.title.isVisible && (
                    <div
                      style={{ ...scaledTitleStyle, textAlign: "right" }}
                      dangerouslySetInnerHTML={{ __html: labels.title.text }}
                    />
                  )}
                </div>
              </div>
              {/* Right Column (Map & Bottom Content) */}
              <div className="flex-1 flex flex-col">
                {/* Map Area */}
                <div
                  ref={mapContainerRef}
                  className="flex-1 relative overflow-hidden" // Takes remaining vertical space
                >
                  <MapComponent
                    key={orientation}
                    ref={mapRef}
                    {...viewState}
                    onMove={(evt) => setViewState(evt.viewState)}
                    mapStyle={mapStyleUrl}
                    mapboxAccessToken={MAPBOX_TOKEN}
                    attributionControl={false}
                    style={{ width: "100%", height: "100%" }}
                    onLoad={handleMapLoad}
                    preserveDrawingBuffer={true}
                    interactive={true}
                    dragRotate={is3D}
                    pitch={is3D ? viewState.pitch ?? 45 : 0}
                    bearing={is3D ? viewState.bearing ?? 0 : 0}
                  >
                    {/* Contrôle de navigation (zoom + -) */}
                    {!(isExporting || hideControls) && (
                      <NavigationControl
                        position="top-right"
                        showCompass={is3D}
                        visualizePitch={is3D}
                      />
                    )}
                    {/* Render Traces and Markers */}
                    {isMapReady &&
                      activeActivities.map((activity) => {
                        if (
                          !activity.trace ||
                          activity.trace.type !== "FeatureCollection" ||
                          !Array.isArray(activity.trace.features) ||
                          activity.trace.features.length === 0
                        )
                          return null;
                        const traceData =
                          activity.trace as FeatureCollection<Geometry>;
                        let lineDasharray: number[] | undefined;
                        if (traceStyle.lineStyle === "dashed")
                          lineDasharray = [
                            traceStyle.width * 2,
                            traceStyle.width * 2,
                          ];
                        else if (traceStyle.lineStyle === "dotted")
                          lineDasharray = [
                            traceStyle.width * 0.1,
                            traceStyle.width * 1.5,
                          ];
                        return (
                          <Source
                            key={`trace-src-${activity.id}-l7`}
                            id={`trace-src-${activity.id}`}
                            type="geojson"
                            data={traceData}
                          >
                            <Layer
                              id={`trace-layer-${activity.id}`}
                              type="line"
                              source={`trace-src-${activity.id}`}
                              filter={["==", "$type", "LineString"]}
                              layout={{
                                "line-join": traceStyle.lineJoin,
                                "line-cap": traceStyle.lineCap,
                              }}
                              paint={{
                                "line-color": traceStyle.color,
                                "line-width": traceStyle.width,
                                "line-opacity": traceStyle.opacity,
                                ...(lineDasharray && {
                                  "line-dasharray": lineDasharray,
                                }),
                              }}
                            />
                          </Source>
                        );
                      })}
                    {isMapReady &&
                      visiblePoints.map((point) => (
                        <Marker
                          key={`${point.id}-l7-marker`}
                          longitude={point.coordinate![0]}
                          latitude={point.coordinate![1]}
                          anchor="bottom"
                        >
                          <CustomMarkerContent
                            type={point.type}
                            text={point.name}
                            description={point.description}
                            shape={point.style.shape}
                            backgroundColor={point.style.color}
                            textColor={point.style.textColor}
                          />
                        </Marker>
                      ))}
                  </MapComponent>
                </div>

                {/* Bottom Content Area (Elevation & Stats) */}
                <div
                  className="flex-none"
                  style={{ marginTop: `${90.6271 * scale}px` }} // Scaled margin from example
                >
                  {profileStyle.isVisible && elevationData.length > 1 && (
                    <div
                      style={{
                        height: `${safeChartHeight * safeScale}px`,
                        width: "100%",
                        marginBottom: `${20 * scale}px` /* Add some space */,
                      }}
                    >
                      <ResponsiveContainer>
                        {profileStyle.style === "area" ? (
                          <AreaChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            {profileStyle.showGradientEffect &&
                              elevationGradient.defs}
                            <Area
                              type="monotone"
                              dataKey="y"
                              stroke="none"
                              fill={
                                profileStyle.showGradientEffect
                                  ? `url(#${elevationGradient.gradientId})`
                                  : profileStyle.color
                              }
                              fillOpacity={1}
                              isAnimationActive={true}
                            />
                          </AreaChart>
                        ) : (
                          <LineChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            <Line
                              type="monotone"
                              dataKey="y"
                              stroke={profileStyle.color}
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={true}
                            />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}
                  {displayStats.length > 0 && (
                    <div className="w-full flex flex-col space-y-1">
                      {" "}
                      {/* Use space-y for vertical spacing */}
                      {displayStats.map((stat, index) => {
                        const statValue = stat.value;
                        return (
                          <div
                            key={index}
                            className="w-full flex items-center justify-between space-x-2 relative"
                          >
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingRight: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {stat.label}{" "}
                            </span>
                            <span
                              className="absolute left-0 right-0 top-1/2 border-b border-dotted border-gray-400"
                              style={{
                                borderColor: "rgba(170, 170, 170, 0.7)",
                                transform: "translateY(-50%)",
                              }}
                            ></span>
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingLeft: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {statValue}{" "}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : layout.selectedLayoutId === "layout-8" ? (
            <>
              {/* Map Container (Fills Parent) */}
              <div
                ref={mapContainerRef}
                className="absolute inset-0 overflow-hidden" // Map takes the whole area inside padding
              >
                <MapComponent
                  key={orientation}
                  ref={mapRef}
                  {...viewState}
                  onMove={(evt) => setViewState(evt.viewState)}
                  mapStyle={mapStyleUrl}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  attributionControl={false}
                  style={{ width: "100%", height: "100%" }}
                  onLoad={handleMapLoad}
                  preserveDrawingBuffer={true}
                  interactive={true}
                  dragRotate={is3D}
                  pitch={is3D ? viewState.pitch ?? 45 : 0}
                  bearing={is3D ? viewState.bearing ?? 0 : 0}
                >
                  {/* Contrôle de navigation (zoom + -) */}
                  {!(isExporting || hideControls) && (
                    <NavigationControl
                      position="top-right"
                      showCompass={is3D}
                      visualizePitch={is3D}
                    />
                  )}
                  {/* Render Traces and Markers */}
                  {isMapReady &&
                    activeActivities.map((activity) => {
                      if (
                        !activity.trace ||
                        activity.trace.type !== "FeatureCollection" ||
                        !Array.isArray(activity.trace.features) ||
                        activity.trace.features.length === 0
                      )
                        return null;
                      const traceData =
                        activity.trace as FeatureCollection<Geometry>;
                      let lineDasharray: number[] | undefined;
                      if (traceStyle.lineStyle === "dashed")
                        lineDasharray = [
                          traceStyle.width * 2,
                          traceStyle.width * 2,
                        ];
                      else if (traceStyle.lineStyle === "dotted")
                        lineDasharray = [
                          traceStyle.width * 0.1,
                          traceStyle.width * 1.5,
                        ];
                      return (
                        <Source
                          key={`trace-src-${activity.id}-l8`}
                          id={`trace-src-${activity.id}`}
                          type="geojson"
                          data={traceData}
                        >
                          <Layer
                            id={`trace-layer-${activity.id}`}
                            type="line"
                            source={`trace-src-${activity.id}`}
                            filter={["==", "$type", "LineString"]}
                            layout={{
                              "line-join": traceStyle.lineJoin,
                              "line-cap": traceStyle.lineCap,
                            }}
                            paint={{
                              "line-color": traceStyle.color,
                              "line-width": traceStyle.width,
                              "line-opacity": traceStyle.opacity,
                              ...(lineDasharray && {
                                "line-dasharray": lineDasharray,
                              }),
                            }}
                          />
                        </Source>
                      );
                    })}
                  {isMapReady &&
                    visiblePoints.map((point) => (
                      <Marker
                        key={`${point.id}-l8-marker`}
                        longitude={point.coordinate![0]}
                        latitude={point.coordinate![1]}
                        anchor="bottom"
                      >
                        <CustomMarkerContent
                          type={point.type}
                          text={point.name}
                          description={point.description}
                          shape={point.style.shape}
                          backgroundColor={point.style.color}
                          textColor={point.style.textColor}
                        />
                      </Marker>
                    ))}
                </MapComponent>
              </div>

              {/* Top-Left Content Overlay Block */}
              <div
                className="absolute z-10" // White background
                style={{
                  top: `${0 * scale}px`, // Scaled position from example
                  left: `${0 * scale}px`, // Scaled position from example
                  width: "35%", // Width from example
                  borderWidth: "0px",
                  backgroundColor: layout.backgroundColor,
                  boxSizing: "border-box",
                }}
              >
                {/* Top Section: Title & Description */}
                <div style={{ padding: `${28 * scale}px` }}>
                  {" "}
                  {/* Scaled padding */}
                  {labels.title.isVisible && (
                    <div
                      style={{
                        ...scaledTitleStyle,
                        textAlign: "left",
                        marginBottom: `${1 * scale}px`,
                      }}
                      dangerouslySetInnerHTML={{ __html: labels.title.text }}
                    />
                  )}
                  {labels.description.isVisible && (
                    <div
                      style={{ ...scaledDescriptionStyle, textAlign: "left" }}
                      dangerouslySetInnerHTML={{
                        __html: labels.description.text,
                      }}
                    />
                  )}
                </div>

                {/* Bottom Section: Elevation & Stats (with top border) */}
                <div
                  style={{
                    borderTop: `${1 * scale}px solid ${scaledTitleStyle.color}`, // Scaled top border
                    padding: `${28 * scale}px`, // Scaled padding
                  }}
                >
                  {profileStyle.isVisible && elevationData.length > 1 && (
                    <div
                      style={{
                        height: `${safeChartHeight * safeScale}px`,
                        width: "100%",
                        marginBottom: `${18 * scale}px` /* Scaled margin */,
                      }}
                    >
                      <ResponsiveContainer>
                        {profileStyle.style === "area" ? (
                          <AreaChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            {profileStyle.showGradientEffect &&
                              elevationGradient.defs}
                            <Area
                              type="monotone"
                              dataKey="y"
                              stroke="none"
                              fill={
                                profileStyle.showGradientEffect
                                  ? `url(#${elevationGradient.gradientId})`
                                  : profileStyle.color
                              }
                              fillOpacity={1}
                              isAnimationActive={true}
                            />
                          </AreaChart>
                        ) : (
                          <LineChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            <Line
                              type="monotone"
                              dataKey="y"
                              stroke={profileStyle.color}
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={true}
                            />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}
                  {displayStats.length > 0 && (
                    <div className="w-full flex flex-col space-y-1">
                      {displayStats.map((stat, index) => {
                        const statValue = stat.value;
                        return (
                          <div
                            key={index}
                            className="w-full flex items-center justify-between space-x-2 relative"
                          >
                            {/* Use white background to hide line behind text */}
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingRight: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {stat.label}{" "}
                            </span>
                            <span
                              className="absolute left-0 right-0 top-1/2 border-b border-dotted"
                              style={{
                                borderColor: scaledStatStyle(stat).color,
                                transform: "translateY(-50%)",
                              }}
                            ></span>
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingLeft: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {statValue}{" "}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : layout.selectedLayoutId === "layout-9" ? (
            // ----- Layout 9: Vertical Text Left (Bottom Aligned), Map Right -----
            <div className="flex h-full">
              {" "}
              {/* Main flex container */}
              {/* Left Column (Vertical Text, Stats, Profile) */}
              <div
                className="flex-none flex flex-col" // Fixed width, flex column
                style={{
                  width: `${294.8 * scale}px`, // Width from example
                  padding: `${101.956 * scale}px`, // Padding from example
                  justifyContent: "flex-end", // Align items (spacer, bottom content) to bottom
                  boxSizing: "border-box",
                }}
              >
                {/* Spacer / Rotated Text Container */}
                <div style={{ flex: "1 1 auto", position: "relative" }}>
                  {" "}
                  {/* Takes up space above bottom content */}
                  <div
                    className="absolute bottom-0 left-0 transform -rotate-90 origin-top-left whitespace-nowrap text-right" // Align text right
                    style={{
                      width: `calc(100% + ${
                        90.6271 * scale
                      }px)` /* Keep height logic like layout-7 */,
                    }}
                  >
                    {/* Description (Rendered first in DOM, appears above Title due to rotation) */}
                    {labels.description.isVisible && (
                      <div
                        style={{
                          ...scaledDescriptionStyle,
                          marginBottom: `${34 * scale}px`,
                          textAlign: "right",
                        }}
                        dangerouslySetInnerHTML={{
                          __html: labels.description.text,
                        }}
                      />
                    )}
                    {/* Title */}
                    {labels.title.isVisible && (
                      <div
                        style={{ ...scaledTitleStyle, textAlign: "right" }}
                        dangerouslySetInnerHTML={{ __html: labels.title.text }}
                      />
                    )}
                  </div>
                </div>

                {/* Bottom Content Area (Elevation & Stats) */}
                <div
                  className="flex-none"
                  style={{ marginTop: `${90.6271 * scale}px` }} // Scaled margin from example
                >
                  {profileStyle.isVisible && elevationData.length > 1 && (
                    <div
                      style={{
                        height: `${safeChartHeight * safeScale}px`,
                        width: "100%",
                        marginBottom: `${20 * scale}px` /* Add some space */,
                      }}
                    >
                      <ResponsiveContainer>
                        {profileStyle.style === "area" ? (
                          <AreaChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            {profileStyle.showGradientEffect &&
                              elevationGradient.defs}
                            <Area
                              type="monotone"
                              dataKey="y"
                              stroke="none"
                              fill={
                                profileStyle.showGradientEffect
                                  ? `url(#${elevationGradient.gradientId})`
                                  : profileStyle.color
                              }
                              fillOpacity={1}
                              isAnimationActive={true}
                            />
                          </AreaChart>
                        ) : (
                          <LineChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            <Line
                              type="monotone"
                              dataKey="y"
                              stroke={profileStyle.color}
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={true}
                            />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}
                  {displayStats.length > 0 && (
                    <div className="w-full flex flex-col space-y-1">
                      {displayStats.map((stat, index) => {
                        const statValue = stat.value;
                        return (
                          <div
                            key={index}
                            className="w-full flex items-center justify-between space-x-2 relative"
                          >
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingRight: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {stat.label}{" "}
                            </span>
                            <span
                              className="absolute left-0 right-0 top-1/2 border-b border-dotted border-gray-400"
                              style={{
                                borderColor: "rgba(170, 170, 170, 0.7)",
                                transform: "translateY(-50%)",
                              }}
                            ></span>
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingLeft: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {statValue}{" "}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              {/* Right Column (Map) */}
              <div className="flex-1 flex">
                {" "}
                {/* Takes remaining space */}
                <div
                  ref={mapContainerRef}
                  className="flex-1 relative overflow-hidden" // Takes all space in this column
                >
                  <MapComponent
                    key={orientation}
                    ref={mapRef}
                    {...viewState}
                    onMove={(evt) => setViewState(evt.viewState)}
                    mapStyle={mapStyleUrl}
                    mapboxAccessToken={MAPBOX_TOKEN}
                    attributionControl={false}
                    style={{ width: "100%", height: "100%" }}
                    onLoad={handleMapLoad}
                    preserveDrawingBuffer={true}
                    interactive={true}
                    dragRotate={is3D}
                    pitch={is3D ? viewState.pitch ?? 45 : 0}
                    bearing={is3D ? viewState.bearing ?? 0 : 0}
                  >
                    {/* Contrôle de navigation (zoom + -) */}
                    {!(isExporting || hideControls) && (
                      <NavigationControl
                        position="top-right"
                        showCompass={is3D}
                        visualizePitch={is3D}
                      />
                    )}
                    {/* Render Traces and Markers */}
                    {isMapReady &&
                      activeActivities.map((activity) => {
                        if (
                          !activity.trace ||
                          activity.trace.type !== "FeatureCollection" ||
                          !Array.isArray(activity.trace.features) ||
                          activity.trace.features.length === 0
                        )
                          return null;
                        const traceData =
                          activity.trace as FeatureCollection<Geometry>;
                        let lineDasharray: number[] | undefined;
                        if (traceStyle.lineStyle === "dashed")
                          lineDasharray = [
                            traceStyle.width * 2,
                            traceStyle.width * 2,
                          ];
                        else if (traceStyle.lineStyle === "dotted")
                          lineDasharray = [
                            traceStyle.width * 0.1,
                            traceStyle.width * 1.5,
                          ];
                        return (
                          <Source
                            key={`trace-src-${activity.id}-l9`}
                            id={`trace-src-${activity.id}`}
                            type="geojson"
                            data={traceData}
                          >
                            <Layer
                              id={`trace-layer-${activity.id}`}
                              type="line"
                              source={`trace-src-${activity.id}`}
                              filter={["==", "$type", "LineString"]}
                              layout={{
                                "line-join": traceStyle.lineJoin,
                                "line-cap": traceStyle.lineCap,
                              }}
                              paint={{
                                "line-color": traceStyle.color,
                                "line-width": traceStyle.width,
                                "line-opacity": traceStyle.opacity,
                                ...(lineDasharray && {
                                  "line-dasharray": lineDasharray,
                                }),
                              }}
                            />
                          </Source>
                        );
                      })}
                    {isMapReady &&
                      visiblePoints.map((point) => (
                        <Marker
                          key={`${point.id}-l9-marker`}
                          longitude={point.coordinate![0]}
                          latitude={point.coordinate![1]}
                          anchor="bottom"
                        >
                          <CustomMarkerContent
                            type={point.type}
                            text={point.name}
                            description={point.description}
                            shape={point.style.shape}
                            backgroundColor={point.style.color}
                            textColor={point.style.textColor}
                          />
                        </Marker>
                      ))}
                  </MapComponent>
                </div>
              </div>
            </div>
          ) : layout.selectedLayoutId === "layout-10" ? (
            // ----- Layout 10: Column, Top Text, Middle Elevation, Bottom Map -----
            <div className="flex flex-col h-full">
              {" "}
              {/* Main Column container */}
              {/* Top Block (Text) */}
              <div
                className="flex-none flex" // Row flex, no grow/shrink
                style={{ paddingBottom: `${27.62 * scale}px` }}
              >
                {/* Left: Text Block */}
                <div
                  className="flex-1"
                  style={{ flexBasis: "50%" }}
                >
                  {" "}
                  {/* Adjust basis as needed */}
                  {labels.title.isVisible && (
                    <div
                      style={{
                        ...scaledTitleStyle,
                        textAlign: "left",
                        marginBottom: `${1 * scale}px`,
                      }}
                      dangerouslySetInnerHTML={{ __html: labels.title.text }}
                    />
                  )}
                  {labels.description.isVisible && (
                    <div
                      style={{ ...scaledDescriptionStyle, textAlign: "left" }}
                      dangerouslySetInnerHTML={{
                        __html: labels.description.text,
                      }}
                    />
                  )}
                </div>
                {/* Right: Stats Block */}
                <div
                  className="flex-1"
                  style={{
                    flexBasis: "50%",
                    paddingLeft: `${107.62 * scale}px`,
                  }}
                >
                  {displayStats.length > 0 && (
                    <div className="w-full flex flex-col space-y-1">
                      {displayStats.map((stat, index) => {
                        const statValue = stat.value;
                        return (
                          <div
                            key={index}
                            className="w-full flex items-center justify-between space-x-2 relative"
                          >
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingRight: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {stat.label}{" "}
                            </span>
                            <span
                              className="absolute left-0 right-0 top-1/2 border-b border-dotted border-gray-400"
                              style={{
                                borderColor: scaledStatStyle(stat).color,
                                transform: "translateY(-50%)",
                              }}
                            ></span>
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingLeft: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {statValue}{" "}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              {/* Middle: Elevation Profile */}
              <div
                className="flex-none"
                style={{ paddingBottom: `${27.62 * scale}px` }} // Space before text/stats block
              >
                {profileStyle.isVisible && elevationData.length > 1 && (
                  <div
                    style={{
                      height: `${safeChartHeight * safeScale}px`,
                      width: "100%",
                    }}
                  >
                    <ResponsiveContainer>
                      {profileStyle.style === "area" ? (
                        <AreaChart
                          data={elevationData}
                          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                        >
                          {profileStyle.showGradientEffect &&
                            elevationGradient.defs}
                          <Area
                            type="monotone"
                            dataKey="y"
                            stroke="none"
                            fill={
                              profileStyle.showGradientEffect
                                ? `url(#${elevationGradient.gradientId})`
                                : profileStyle.color
                            }
                            fillOpacity={1}
                            isAnimationActive={true}
                          />
                        </AreaChart>
                      ) : (
                        <LineChart
                          data={elevationData}
                          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                        >
                          <Line
                            type="monotone"
                            dataKey="y"
                            stroke={profileStyle.color}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={true}
                          />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              {/* Bottom: Map Area */}
              <div
                ref={mapContainerRef}
                className="flex-1 relative overflow-hidden" // Takes remaining space
              >
                <MapComponent
                  key={orientation}
                  ref={mapRef}
                  {...viewState}
                  onMove={(evt) => setViewState(evt.viewState)}
                  mapStyle={mapStyleUrl}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  attributionControl={false}
                  style={{ width: "100%", height: "100%" }}
                  onLoad={handleMapLoad}
                  preserveDrawingBuffer={true}
                  interactive={true}
                  dragRotate={is3D}
                  pitch={is3D ? viewState.pitch ?? 45 : 0}
                  bearing={is3D ? viewState.bearing ?? 0 : 0}
                >
                  {/* Contrôle de navigation (zoom + -) */}
                  {!(isExporting || hideControls) && (
                    <NavigationControl
                      position="top-right"
                      showCompass={is3D}
                      visualizePitch={is3D}
                    />
                  )}
                  {/* Render Traces and Markers */}
                  {isMapReady &&
                    activeActivities.map((activity) => {
                      if (
                        !activity.trace ||
                        activity.trace.type !== "FeatureCollection" ||
                        !Array.isArray(activity.trace.features) ||
                        activity.trace.features.length === 0
                      )
                        return null;
                      const traceData =
                        activity.trace as FeatureCollection<Geometry>;
                      let lineDasharray: number[] | undefined;
                      if (traceStyle.lineStyle === "dashed")
                        lineDasharray = [
                          traceStyle.width * 2,
                          traceStyle.width * 2,
                        ];
                      else if (traceStyle.lineStyle === "dotted")
                        lineDasharray = [
                          traceStyle.width * 0.1,
                          traceStyle.width * 1.5,
                        ];
                      return (
                        <Source
                          key={`trace-src-${activity.id}-l10`}
                          id={`trace-src-${activity.id}`}
                          type="geojson"
                          data={traceData}
                        >
                          <Layer
                            id={`trace-layer-${activity.id}`}
                            type="line"
                            source={`trace-src-${activity.id}`}
                            filter={["==", "$type", "LineString"]}
                            layout={{
                              "line-join": traceStyle.lineJoin,
                              "line-cap": traceStyle.lineCap,
                            }}
                            paint={{
                              "line-color": traceStyle.color,
                              "line-width": traceStyle.width,
                              "line-opacity": traceStyle.opacity,
                              ...(lineDasharray && {
                                "line-dasharray": lineDasharray,
                              }),
                            }}
                          />
                        </Source>
                      );
                    })}
                  {isMapReady &&
                    visiblePoints.map((point) => (
                      <Marker
                        key={`${point.id}-l10-marker`}
                        longitude={point.coordinate![0]}
                        latitude={point.coordinate![1]}
                        anchor="bottom"
                      >
                        <CustomMarkerContent
                          type={point.type}
                          text={point.name}
                          description={point.description}
                          shape={point.style.shape}
                          backgroundColor={point.style.color}
                          textColor={point.style.textColor}
                        />
                      </Marker>
                    ))}
                </MapComponent>
              </div>
            </div>
          ) : layout.selectedLayoutId === "layout-11" ? (
            // ----- Layout 11: Column, Top Map, Middle Elevation, Bottom (Text Left, Stats Right) -----
            <div className="flex flex-col h-full">
              {" "}
              {/* Main Column container */}
              {/* Top: Map Area (Takes remaining space) */}
              <div
                ref={mapContainerRef}
                className="flex-1 relative overflow-hidden" // Takes most space
                style={{ marginBottom: `${107.62 * scale}px` }} // Space before elevation
              >
                <MapComponent
                  key={orientation}
                  ref={mapRef}
                  {...viewState}
                  onMove={(evt) => setViewState(evt.viewState)}
                  mapStyle={mapStyleUrl}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  attributionControl={false}
                  style={{ width: "100%", height: "100%" }}
                  onLoad={handleMapLoad}
                  preserveDrawingBuffer={true}
                  interactive={true}
                  dragRotate={is3D}
                  pitch={is3D ? viewState.pitch ?? 45 : 0}
                  bearing={is3D ? viewState.bearing ?? 0 : 0}
                >
                  {/* Contrôle de navigation (zoom + -) */}
                  {!(isExporting || hideControls) && (
                    <NavigationControl
                      position="top-right"
                      showCompass={is3D}
                      visualizePitch={is3D}
                    />
                  )}
                  {/* Render Traces and Markers */}
                  {isMapReady &&
                    activeActivities.map((activity) => {
                      if (
                        !activity.trace ||
                        activity.trace.type !== "FeatureCollection" ||
                        !Array.isArray(activity.trace.features) ||
                        activity.trace.features.length === 0
                      )
                        return null;
                      const traceData =
                        activity.trace as FeatureCollection<Geometry>;
                      let lineDasharray: number[] | undefined;
                      if (traceStyle.lineStyle === "dashed")
                        lineDasharray = [
                          traceStyle.width * 2,
                          traceStyle.width * 2,
                        ];
                      else if (traceStyle.lineStyle === "dotted")
                        lineDasharray = [
                          traceStyle.width * 0.1,
                          traceStyle.width * 1.5,
                        ];
                      return (
                        <Source
                          key={`trace-src-${activity.id}-l11`}
                          id={`trace-src-${activity.id}`}
                          type="geojson"
                          data={traceData}
                        >
                          <Layer
                            id={`trace-layer-${activity.id}`}
                            type="line"
                            source={`trace-src-${activity.id}`}
                            filter={["==", "$type", "LineString"]}
                            layout={{
                              "line-join": traceStyle.lineJoin,
                              "line-cap": traceStyle.lineCap,
                            }}
                            paint={{
                              "line-color": traceStyle.color,
                              "line-width": traceStyle.width,
                              "line-opacity": traceStyle.opacity,
                              ...(lineDasharray && {
                                "line-dasharray": lineDasharray,
                              }),
                            }}
                          />
                        </Source>
                      );
                    })}
                  {isMapReady &&
                    visiblePoints.map((point) => (
                      <Marker
                        key={`${point.id}-l11-marker`}
                        longitude={point.coordinate![0]}
                        latitude={point.coordinate![1]}
                        anchor="bottom"
                      >
                        <CustomMarkerContent
                          type={point.type}
                          text={point.name}
                          description={point.description}
                          shape={point.style.shape}
                          backgroundColor={point.style.color}
                          textColor={point.style.textColor}
                        />
                      </Marker>
                    ))}
                </MapComponent>
              </div>
              {/* Middle: Elevation Profile */}
              <div
                className="flex-none"
                style={{ paddingBottom: `${107.62 * scale}px` }} // Space before text/stats block
              >
                {profileStyle.isVisible && elevationData.length > 1 && (
                  <div
                    style={{
                      height: `${safeChartHeight * safeScale}px`,
                      width: "100%",
                    }}
                  >
                    <ResponsiveContainer>
                      {profileStyle.style === "area" ? (
                        <AreaChart
                          data={elevationData}
                          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                        >
                          {profileStyle.showGradientEffect &&
                            elevationGradient.defs}
                          <Area
                            type="monotone"
                            dataKey="y"
                            stroke="none"
                            fill={
                              profileStyle.showGradientEffect
                                ? `url(#${elevationGradient.gradientId})`
                                : profileStyle.color
                            }
                            fillOpacity={1}
                            isAnimationActive={true}
                          />
                        </AreaChart>
                      ) : (
                        <LineChart
                          data={elevationData}
                          margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                        >
                          <Line
                            type="monotone"
                            dataKey="y"
                            stroke={profileStyle.color}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={true}
                          />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              {/* Bottom Block (Text & Stats) */}
              <div
                className="flex-none flex" // Row flex, no grow/shrink
              >
                {/* Left: Text Block */}
                <div
                  className="flex-1"
                  style={{ flexBasis: "50%" }}
                >
                  {" "}
                  {/* Takes 50% width */}
                  {labels.title.isVisible && (
                    <div
                      style={{
                        ...scaledTitleStyle,
                        textAlign: "left",
                        marginBottom: `${34 * scale}px` /* from layout-5 */,
                      }}
                      dangerouslySetInnerHTML={{ __html: labels.title.text }}
                    />
                  )}
                  {labels.description.isVisible && (
                    <div
                      style={{ ...scaledDescriptionStyle, textAlign: "left" }}
                      dangerouslySetInnerHTML={{
                        __html: labels.description.text,
                      }}
                    />
                  )}
                </div>
                {/* Right: Stats Block */}
                <div
                  className="flex-1"
                  style={{
                    flexBasis: "50%",
                    paddingLeft: `${107.62 * scale}px`,
                  }}
                >
                  {" "}
                  {/* Takes 50% width, padding from example */}
                  {displayStats.length > 0 && (
                    <div className="w-full flex flex-col space-y-1">
                      {displayStats.map((stat, index) => {
                        const statValue = stat.value;
                        return (
                          <div
                            key={index}
                            className="w-full flex items-center justify-between space-x-2 relative"
                          >
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingRight: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {stat.label}{" "}
                            </span>
                            <span
                              className="absolute left-0 right-0 top-1/2 border-b border-dotted border-gray-400"
                              style={{
                                borderColor: "rgb(76, 76, 76)",
                                transform: "translateY(-50%)",
                              }} // Color from example
                            ></span>
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingLeft: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {statValue}{" "}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : layout.selectedLayoutId === "layout-12" ? (
            // ----- Layout 12: Column, Top Map, Middle Text, Bottom Stats/Profile -----
            <div className="flex flex-col h-full">
              {" "}
              {/* Main Column container */}
              {/* Top: Map Area (Takes remaining space) */}
              <div
                ref={mapContainerRef}
                className="flex-1 relative overflow-hidden" // Takes most space
                style={{ marginBottom: `${50.6271 * scale}px` }} // Space before text block (approximate from example paddingTop on text)
              >
                <MapComponent
                  key={orientation}
                  ref={mapRef}
                  {...viewState}
                  onMove={(evt) => setViewState(evt.viewState)}
                  mapStyle={mapStyleUrl}
                  mapboxAccessToken={MAPBOX_TOKEN}
                  attributionControl={false}
                  style={{ width: "100%", height: "100%" }}
                  onLoad={handleMapLoad}
                  preserveDrawingBuffer={true}
                  interactive={true}
                  dragRotate={is3D}
                  pitch={is3D ? viewState.pitch ?? 45 : 0}
                  bearing={is3D ? viewState.bearing ?? 0 : 0}
                >
                  {/* Contrôle de navigation (zoom + -) */}
                  {!(isExporting || hideControls) && (
                    <NavigationControl
                      position="top-right"
                      showCompass={is3D}
                      visualizePitch={is3D}
                    />
                  )}
                  {/* Render Traces and Markers */}
                  {isMapReady &&
                    activeActivities.map((activity) => {
                      if (
                        !activity.trace ||
                        activity.trace.type !== "FeatureCollection" ||
                        !Array.isArray(activity.trace.features) ||
                        activity.trace.features.length === 0
                      )
                        return null;
                      const traceData =
                        activity.trace as FeatureCollection<Geometry>;
                      let lineDasharray: number[] | undefined;
                      if (traceStyle.lineStyle === "dashed")
                        lineDasharray = [
                          traceStyle.width * 2,
                          traceStyle.width * 2,
                        ];
                      else if (traceStyle.lineStyle === "dotted")
                        lineDasharray = [
                          traceStyle.width * 0.1,
                          traceStyle.width * 1.5,
                        ];
                      return (
                        <Source
                          key={`trace-src-${activity.id}-l12`}
                          id={`trace-src-${activity.id}`}
                          type="geojson"
                          data={traceData}
                        >
                          <Layer
                            id={`trace-layer-${activity.id}`}
                            type="line"
                            source={`trace-src-${activity.id}`}
                            filter={["==", "$type", "LineString"]}
                            layout={{
                              "line-join": traceStyle.lineJoin,
                              "line-cap": traceStyle.lineCap,
                            }}
                            paint={{
                              "line-color": traceStyle.color,
                              "line-width": traceStyle.width,
                              "line-opacity": traceStyle.opacity,
                              ...(lineDasharray && {
                                "line-dasharray": lineDasharray,
                              }),
                            }}
                          />
                        </Source>
                      );
                    })}
                  {isMapReady &&
                    visiblePoints.map((point) => (
                      <Marker
                        key={`${point.id}-l12-marker`}
                        longitude={point.coordinate![0]}
                        latitude={point.coordinate![1]}
                        anchor="bottom"
                      >
                        <CustomMarkerContent
                          type={point.type}
                          text={point.name}
                          description={point.description}
                          shape={point.style.shape}
                          backgroundColor={point.style.color}
                          textColor={point.style.textColor}
                        />
                      </Marker>
                    ))}
                </MapComponent>
              </div>
              {/* Middle: Text Block (Centered) */}
              <div
                className="flex-none text-center" // Centered text
                style={{ paddingBottom: `${-50 * scale}px` }} // Space before stats/profile block (approximate from example paddingTop on stats)
              >
                {labels.title.isVisible && (
                  <div
                    style={{
                      ...scaledTitleStyle,
                      marginBottom: `${
                        1 * scale
                      }px` /* From layout-3 example */,
                    }}
                    dangerouslySetInnerHTML={{ __html: labels.title.text }}
                  />
                )}
                {labels.description.isVisible && (
                  <div
                    style={{ ...scaledDescriptionStyle }}
                    dangerouslySetInnerHTML={{
                      __html: labels.description.text,
                    }}
                  />
                )}
              </div>
              {/* Bottom Block (Elevation & Stats) */}
              <div
                className="flex-none flex flex-col-reverse" // flex-col-reverse to match HTML order (Stats above Profile)
              >
                {/* Stats */}
                <div
                  className="flex-none"
                  style={{ paddingTop: `${17.9704 * scale}px` }}
                >
                  {" "}
                  {/* Approximate padding before stats */}
                  {displayStats.length > 0 && (
                    <div className="w-full flex flex-col space-y-1">
                      {displayStats.map((stat, index) => {
                        const statValue = stat.value;
                        return (
                          <div
                            key={index}
                            className="w-full flex items-center justify-between space-x-2 relative"
                          >
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingRight: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {stat.label}{" "}
                            </span>
                            {/* Dotted line */}
                            <span
                              className="absolute left-0 right-0 top-1/2 border-b border-dotted border-gray-400"
                              style={{
                                borderColor: scaledStatStyle(stat).color,
                                transform: "translateY(-50%)",
                              }}
                            ></span>
                            <span
                              style={{
                                ...scaledStatStyle(stat),
                                backgroundColor: layout.backgroundColor,
                                position: "relative",
                                display: "inline-block",
                                paddingLeft: `${5 * scale}px`,
                                zIndex: 1,
                              }}
                            >
                              {" "}
                              {statValue}{" "}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* Elevation Profile */}
                <div
                  className="flex-none"
                  style={{
                    paddingTop: `${17.9704 * scale}px`,
                    paddingBottom: `${1 * scale}px`,
                  }}
                >
                  {" "}
                  {/* Added padding above profile */}
                  {profileStyle.isVisible && elevationData.length > 1 && (
                    <div
                      style={{
                        height: `${safeChartHeight * safeScale}px`,
                        width: "100%",
                      }}
                    >
                      <ResponsiveContainer>
                        {profileStyle.style === "area" ? (
                          <AreaChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            {profileStyle.showGradientEffect &&
                              elevationGradient.defs}
                            <Area
                              type="monotone"
                              dataKey="y"
                              stroke="none"
                              fill={
                                profileStyle.showGradientEffect
                                  ? `url(#${elevationGradient.gradientId})`
                                  : profileStyle.color
                              }
                              fillOpacity={1}
                              isAnimationActive={true}
                            />
                          </AreaChart>
                        ) : (
                          <LineChart
                            data={elevationData}
                            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                          >
                            <Line
                              type="monotone"
                              dataKey="y"
                              stroke={profileStyle.color}
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={true}
                            />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // ----- Fallback for other layouts -----
            <div className="flex items-center justify-center w-full h-full text-gray-500">
              Layout not implemented yet.
            </div>
          )}
        </div>{" "}
        {/* End Relative Container */}
      </div>
    );
  }
);

export default EditorPreview;
