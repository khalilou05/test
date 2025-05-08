import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface MapStyleOption {
  id: string;
  name: string;
  thumbnail: string;
  url: string;
  hasTerrain: boolean;
  hasLabels: boolean; // Indicates if labels are *intended* to be visible by default in this style
}

// Add your actual thumbnails in /public/thumbnails/
export const MAP_STYLE_OPTIONS: MapStyleOption[] = [
  {
    id: "light-v11",
    name: "Light",
    thumbnail: "/thumbnails/map-light.png",
    url: "mapbox://styles/mapbox/light-v11",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "dark-v11",
    name: "Dark",
    thumbnail: "/thumbnails/map-dark.png",
    url: "mapbox://styles/mapbox/dark-v11",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "streets-v12",
    name: "Streets",
    thumbnail: "/thumbnails/map-streets.png",
    url: "mapbox://styles/mapbox/streets-v12",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "outdoors-v12",
    name: "Outdoors",
    thumbnail: "/thumbnails/map-outdoors.png",
    url: "mapbox://styles/mapbox/outdoors-v12",
    hasTerrain: true,
    hasLabels: true,
  },
  {
    id: "satellite-streets-v12",
    name: "Satellite",
    thumbnail: "/thumbnails/map-satellite.png",
    url: "mapbox://styles/mapbox/satellite-streets-v12",
    hasTerrain: true,
    hasLabels: true,
  },
  {
    id: "navigation-day-v1",
    name: "Navigation Day",
    thumbnail: "/thumbnails/map-nav-day.png",
    url: "mapbox://styles/mapbox/navigation-day-v1",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "navigation-night-v1",
    name: "Navigation Night",
    thumbnail: "/thumbnails/map-nav-night.png",
    url: "mapbox://styles/mapbox/navigation-night-v1",
    hasTerrain: false,
    hasLabels: true,
  },
  // Example custom styles (replace URLs)
  // { id: 'your-custom-style', name: 'My Custom Style', thumbnail: '/thumbnails/map-custom.png', url: 'mapbox://styles/your-account/your-style-id', hasTerrain: false, hasLabels: true },
  // --- Added custom styles ---
  {
    id: "clp7byil9008c01r1f993hq8z",
    name: "Style 1",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7byil9008c01r1f993hq8z",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clpdvrkt000cs01pkf6kgagv6",
    name: "Style 2",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clpdvrkt000cs01pkf6kgagv6",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7eg9hs00pb01quc3o56qzg",
    name: "Style 3",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7eg9hs00pb01quc3o56qzg",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7diq3j00l701qtda2cfyyy",
    name: "Style 4",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7diq3j00l701qtda2cfyyy",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clofre2w9005001pigqlm8d17",
    name: "Style 5",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clofre2w9005001pigqlm8d17",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7dg4e800l501qt9i8tdpnl",
    name: "Style 6",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7dg4e800l501qt9i8tdpnl",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7e3qic01pu01qyhsx14mps",
    name: "Style 7",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7e3qic01pu01qyhsx14mps",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7ei8ds01ro01qm72vebo18",
    name: "Style 8",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7ei8ds01ro01qm72vebo18",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7ekf3l00ho01qxft8c9ft0",
    name: "Style 9",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7ekf3l00ho01qxft8c9ft0",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7f2heu00hq01qxe8m0d0o9",
    name: "Style 10",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7f2heu00hq01qxe8m0d0o9",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7ahb8f01r901qmd84w1kxi",
    name: "Style 11",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7ahb8f01r901qmd84w1kxi",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clofrqofv006k01o6bgbk86vt",
    name: "Style 12",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clofrqofv006k01o6bgbk86vt",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7fc9fe00kk01pc0iuhb2mu",
    name: "Style 13",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7fc9fe00kk01pc0iuhb2mu",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7f9pg800lh01qtaex9gdre",
    name: "Style 14",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7f9pg800lh01qtaex9gdre",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7f3lwz00hr01qx8a9z039n",
    name: "Style 15",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7f3lwz00hr01qx8a9z039n",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7edrpc008j01r1e07s3uun",
    name: "Style 16",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7edrpc008j01r1e07s3uun",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7eb3ax00kh01pc2zig7uxw",
    name: "Style 17",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7eb3ax00kh01pc2zig7uxw",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7dekvf00kf01pcfslw8n0f",
    name: "Style 18",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7dekvf00kf01pcfslw8n0f",
    hasTerrain: false,
    hasLabels: true,
  },
  {
    id: "clp7e7zn300la01qt55j98jty",
    name: "Style 19",
    thumbnail: "/thumbnails/map-custom.png",
    url: "mapbox://styles/wiloud12/clp7e7zn300la01qt55j98jty",
    hasTerrain: false,
    hasLabels: true,
  },
  // --- End of added custom styles ---
];

interface MapState {
  selectedStyleId: string;
  showTerrain: boolean;
  showLabels: boolean; // User's preference to show/hide labels
  pitch: number;
  bearing: number;
}

const initialState: MapState = {
  selectedStyleId: MAP_STYLE_OPTIONS[0].id,
  showTerrain: false,
  showLabels: true,
  pitch: 0,
  bearing: 0,
};

const mapSlice = createSlice({
  name: "map",
  initialState,
  reducers: {
    setMapStyle: (state, action: PayloadAction<string>) => {
      const style = MAP_STYLE_OPTIONS.find((s) => s.id === action.payload);
      if (style) {
        state.selectedStyleId = action.payload;
        // Reset terrain toggle only if the new style doesn't support it
        if (!style.hasTerrain) {
          state.showTerrain = false;
        }
        // Automatically show labels if the style has them by default, otherwise hide
        // state.showLabels = style.hasLabels; // Or let user preference persist? Let's persist user pref.
      }
    },
    setShowTerrain: (state, action: PayloadAction<boolean>) => {
      const style = MAP_STYLE_OPTIONS.find(
        (s) => s.id === state.selectedStyleId
      );
      // Only allow terrain if the style supports it
      if (style?.hasTerrain) {
        state.showTerrain = action.payload;
      } else {
        state.showTerrain = false; // Force disable if not supported
      }
    },
    setShowLabels: (state, action: PayloadAction<boolean>) => {
      state.showLabels = action.payload;
    },
    setPitch: (state, action: PayloadAction<number>) => {
      state.pitch = Math.max(0, Math.min(85, action.payload));
    },
    setBearing: (state, action: PayloadAction<number>) => {
      state.bearing = ((action.payload % 360) + 360) % 360;
    },
    rotateMap: (state, action: PayloadAction<number>) => {
      // Action to rotate by a certain amount
      state.bearing = (((state.bearing + action.payload) % 360) + 360) % 360;
    },
    resetMapControls: (state) => {
      // Resets pitch, bearing, terrain, labels
      state.pitch = initialState.pitch;
      state.bearing = initialState.bearing;
      state.showTerrain = initialState.showTerrain;
      state.showLabels = initialState.showLabels;
    },
    setMapState: (state, action: PayloadAction<MapState>) => {
      return action.payload;
    },
  },
});

export const {
  setMapStyle,
  setShowTerrain,
  setShowLabels,
  setPitch,
  setBearing,
  rotateMap,
  resetMapControls,
  setMapState,
} = mapSlice.actions;

export default mapSlice.reducer;
