import clsx from 'clsx';
import { Suspense } from "react";
import { useEffect, useRef, useState } from "react";
import { Tooltip } from "react-tooltip";
import { NavLink, Route, Routes } from "react-router-dom";
import {
  HiHome,
  HiUpload,
  HiTemplate,
  HiLocationMarker,
  HiTag,
  HiViewGrid,
  HiMap,
  HiAdjustments,
  HiChartBar
} from "react-icons/hi";
import { useTranslation } from 'react-i18next';

import Spinner from "../components/Spinner";
import ErrorBoundary from "../components/ErrorBoundary";
import AnimationLayout from "../components/AnimationLayout";

// Pages
import Overview from "../pages/Overview.tsx";
import Activities from "../pages/Activities.tsx";
import Points from "../pages/Points.tsx";
import Labels from "../pages/Labels.tsx";
import TemplatePage from "../pages/Template.tsx";
import Layout from "../pages/Layout.tsx";
import MapStyle from "../pages/MapStyle.tsx";
import Trace from "../pages/Trace.tsx";
import Profile from "../pages/Profile.tsx";
import Cart from "../pages/Cart.tsx";
import Checkout from "../pages/Checkout.tsx";
import Success from "../pages/Success.tsx";

interface SidebarProps {
  isSidebarOpen: boolean;
  mapEditorRef: any;
}

const Sidebar = ({ isSidebarOpen, mapEditorRef }: SidebarProps) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(isSidebarOpen);
  const { t } = useTranslation();

  useEffect(() => {
    if (isSidebarOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isSidebarOpen]);

  const navItems = [
    { path: "/overview", icon: HiHome, label: "Accueil" },
    { path: "/activities", icon: HiUpload, label: "Activités" },
    { path: "/points", icon: HiLocationMarker, label: "Points" },
    { path: "/templates", icon: HiTemplate, label: "Modèles" },
    { path: "/labels", icon: HiTag, label: "Étiquettes" },
    { path: "/layout", icon: HiViewGrid, label: "Mise en page" },
    { path: "/map", icon: HiMap, label: "Carte" },
    { path: "/trace", icon: HiAdjustments, label: "Tracé" },
    { path: "/profile", icon: HiChartBar, label: "Profil" },
  ];

  return (
    <aside
      ref={sidebarRef}
      className={`bg-[#222] min-w-full max-w-full md:min-w-[450px] md:w-[450px] md:max-w-[450px] pl-1 md:pl-4 shadow-md flex flex-row gap-1 md:gap-4 border-r border-[#333] h-[calc(100vh-61px)] transition-all duration-300 ease-in-out ${
        isSidebarOpen
          ? "translate-x-0 opacity-100"
          : "-translate-x-full opacity-0"
      } ${isVisible ? "block" : "absolute"}`}
    >
      {/* Navigation Icons */}
      <div className="py-1 md:py-4 pr-1 md:pr-4 border-r border-[#333] overflow-y-auto scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-[#222] max-h-[calc(100vh-61px)]">
        <ul className="space-y-1 md:space-y-4">
          {navItems.map((item) => (
            <li key={item.path} className="h-12 md:h-16">
              <NavLink
                to={item.path}
                data-tooltip-id={`${item.label.toLowerCase()}-tooltip`}
                data-tooltip-content={t(`sidebar.${item.label}`)}
                className={({ isActive }) => clsx(
                  'w-full h-full px-2 py-2 rounded flex flex-col items-center justify-center cursor-pointer text-center',
                  isActive ? 'bg-[#333333]' : 'hover:bg-[#2A2A2A]'
                )}
              >
                <item.icon className="w-4 h-4 md:w-6 md:h-6 text-white mb-0.5 md:mb-1" />
                <span className="text-[9px] md:text-xs text-white">{t(`sidebar.${item.label}`)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      {/* Page Content Area */}
      <div className="flex-1 pr-4 py-8 overflow-y-auto scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-[#222] max-h-full">
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Spinner />
              </div>
            }
          >
            <Routes>
              <Route element={<AnimationLayout />}>
                <Route path="/" element={<Overview editorPreviewRef={mapEditorRef} />} />
                <Route path="/overview" element={<Overview editorPreviewRef={mapEditorRef} />} />
                <Route path="/activities" element={<Activities mapEditorRef={mapEditorRef} />} />
                <Route path="/points" element={<Points mapEditorRef={mapEditorRef}/>}/>
                <Route path="/labels" element={<Labels mapEditorRef={mapEditorRef}/>}/>
                <Route path="/templates" element={<TemplatePage mapEditorRef={mapEditorRef} />} />
                <Route path="/layout" element={<Layout mapEditorRef={mapEditorRef} />} />
                <Route path="/map" element={<MapStyle mapEditorRef={mapEditorRef} />} />
                <Route path="/trace" element={<Trace mapEditorRef={mapEditorRef} />} />
                <Route path="/profile" element={<Profile mapEditorRef={mapEditorRef} />} />
              </Route>
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/commande/succes" element={<Success />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* Tooltips */}
      {navItems.map(item => (
        <Tooltip
          key={`${item.label.toLowerCase()}-tooltip`}
          id={`${item.label.toLowerCase()}-tooltip`}
          place="right"
          style={{ backgroundColor: "#333", color: "#fff", zIndex: 9999 }}
          opacity={1}
        />
      ))}
    </aside>
  );
};

export default Sidebar;