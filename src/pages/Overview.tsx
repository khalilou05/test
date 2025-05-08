import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiTemplate, HiUpload } from "react-icons/hi";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, useNavigate } from "react-router-dom";
import CartLoaderOverlay from "../components/CartLoaderOverlay";
import { EditorPreviewRef } from "../components/EditorPreview";
import { AppDispatch, RootState } from "../store";
import { addActivity, setActiveActivityIds } from "../store/activitiesSlice";
import { addPosterToCart } from "../store/cartSlice";
import { initializePoints } from "../store/pointsSlice";
import { handleFileUpload } from "../utils/fileUpload";

interface OverviewProps {
  editorPreviewRef: React.RefObject<EditorPreviewRef>;
}

const Overview: React.FC<OverviewProps> = ({ editorPreviewRef }) => {
  const navigate = useNavigate();
  const dispatch: AppDispatch = useDispatch();
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const labels = useSelector((state: RootState) => state.labels);
  const points = useSelector((state: RootState) => state.points.points);
  const layout = useSelector((state: RootState) => state.layout);
  const map = useSelector((state: RootState) => state.map);
  const trace = useSelector((state: RootState) => state.trace);
  const profile = useSelector((state: RootState) => state.profile);

  const product = useSelector((state: RootState) => state.product);
  const activities = useSelector((state: RootState) => state.activities);
  const activities2 = useSelector(
    (state: RootState) => state.activities.activities || []
  );
  const activeActivityIds = useSelector(
    (state: RootState) => state.activities.activeActivityIds || []
  );
  const currentPrice = product.currentPrice;

  const { t } = useTranslation();

  const handleAddToCart = async () => {
    if (
      !editorPreviewRef.current ||
      !editorPreviewRef.current.generatePreviewImage
    ) {
      alert(
        "Erreur : Impossible d'accéder à l'éditeur ou à la carte pour générer l'aperçu."
      );
      return;
    }
    setIsAddingToCart(true);
    try {
      const thumbnailUrl =
        await editorPreviewRef.current.generatePreviewImage();
      const { currentPrice: _, ...productDetails } = product;
      const productForCart = {
        ...productDetails,
        price: currentPrice,
      };
      const posterConfiguration = {
        labels,
        points,
        layout,
        map,
        trace,
        profile,
        product: productForCart,
        activeActivityIds: activities.activeActivityIds,
        activitiesData: activities.activities,
      };
      dispatch(
        addPosterToCart({
          id: `cart-${Date.now()}-${Math.random()
            .toString(16)
            .substring(2, 8)}`,
          configuration: posterConfiguration,
          thumbnailUrl: thumbnailUrl ?? undefined,
        })
      );
      navigate("/cart");
    } catch (error) {
      alert("Erreur lors de l'ajout au panier");
    } finally {
      setIsAddingToCart(false);
    }
  };

  useEffect(() => {
    const loadDefaultGpx = async () => {
      if (activities2.length > 0) return; // Do not load if already has activity

      try {
        const res = await fetch("/paris-marathon.gpx");
        const text = await res.text();

        const file = new File([text], "paris-marathon.gpx", {
          type: "application/gpx+xml",
        });

        // Simulate a fake input event to reuse existing logic
        const fakeEvent = {
          target: { files: [file] },
        } as unknown as React.ChangeEvent<HTMLInputElement>;

        const newActivities = await handleFileUpload(fakeEvent, activities2);
        if (newActivities.length > 0) {
          dispatch(addActivity(newActivities));
          dispatch(initializePoints(newActivities));
          const newIds = newActivities.map((a) => a.id);
          dispatch(setActiveActivityIds([...activeActivityIds, ...newIds]));
        }
      } catch (err: any) {
        console.error("Failed to auto-load Paris Marathon GPX:", err);
      }
    };

    loadDefaultGpx();
  }, []);

  return (
    <div className="space-y-8 max-w-full min-h-full">
      {/* Overlay loader */}
      {isAddingToCart && (
        <CartLoaderOverlay message={t("overview.adding_to_cart")} />
      )}
      <div className="space-y-1 ">
        <div className="font-sans font-bold text-white">
          {t("overview.title")}
        </div>
        <div className="mt-1 text-gray-400 font-light text-sm">
          {t("overview.subtitle")}
        </div>
      </div>
      <div className="space-y-4">
        <NavLink
          to={"/activities"}
          className="w-full cursor-pointer flex justify-center items-center space-x-2 bg-[#333333] hover:bg-[#444444] text-white text-sm py-2 rounded-sm"
        >
          <HiUpload />
          <span>{t("overview.download_activity")}</span>
        </NavLink>
        <NavLink
          to={"/templates"}
          className="w-full cursor-pointer flex justify-center items-center space-x-2 bg-[#333333] hover:bg-[#444444] text-white text-sm py-2 rounded-sm"
        >
          <HiTemplate />
          <span>{t("overview.change_template")}</span>
        </NavLink>
      </div>
      <div className="space-y-4">
        <div className="text-white font-sans font-medium">
          {t("overview.customize")}
        </div>
        <div className="space-y-2">
          <NavLink
            to={"/points"}
            className="w-full text-sm cursor-pointer flex items-center space-x-2 py-2 px-4 rounded-sm hover:bg-[#2A2A2A]"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.243l-4.243-4.243m0 0L9.172 7.757M13.414 12H21m-7.586 4.243l4.243 4.243M6.343 17.657l-4.243-4.243M6.343 17.657l4.243-4.243M3 21v-7.586"
              />
            </svg>
            <span className="text-gray-400 font-light">
              {t("overview.points")}
            </span>
          </NavLink>
          <NavLink
            to={"/labels"}
            className="w-full text-sm cursor-pointer flex items-center space-x-2 py-2 px-4 rounded-sm hover:bg-[#2A2A2A]"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h13M3 4v16M3 4l4 4M16 4l-4 4M16 4v16m-4-8h9"
              />
            </svg>
            <span className="text-gray-400 font-light">
              {t("overview.labels")}
            </span>
          </NavLink>
          <NavLink
            to={"/layout"}
            className="w-full text-sm cursor-pointer flex items-center space-x-2 py-2 px-4 rounded-sm hover:bg-[#2A2A2A]"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h18M3 9h18M3 15h18M3 21h18"
              />
            </svg>
            <span className="text-gray-400 font-light">
              {t("overview.layout")}
            </span>
          </NavLink>
          <NavLink
            to={"/map"}
            className="w-full text-sm cursor-pointer flex items-center space-x-2 py-2 px-4 rounded-sm hover:bg-[#2A2A2A]"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A2 2 0 013 15.382V5.618a2 2 0 011.447-1.894L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A2 2 0 0021 19.382V9.618a2 2 0 00-1.447-1.894L15 6m0 11V2m0 0l-6 3"
              />
            </svg>
            <span className="text-gray-400 font-light">
              {t("overview.map")}
            </span>
          </NavLink>
          {/* <NavLink
            to={"/sizes"}
            className="w-full text-sm cursor-pointer flex items-center space-x-2 py-2 px-4 rounded-sm hover:bg-[#2A2A2A]"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0H8M4 4l5 5m11-1V4m0 0h-4m4 4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 0h-4"
              />
            </svg>
            <span className="text-gray-400 font-light">Taille</span>
          </NavLink> */}
        </div>
      </div>
      <button
        onClick={handleAddToCart}
        disabled={isAddingToCart}
        className="w-full text-sm cursor-pointer flex justify-center items-center space-x-2 bg-orange-500 hover:opacity-75 text-white py-2 rounded-sm disabled:opacity-50 disabled:cursor-wait"
      >
        {isAddingToCart ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>{t("overview.adding_to_cart")}</span>
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 1 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span>{t("overview.add_to_cart")}</span>
          </>
        )}
      </button>
    </div>
  );
};

export default Overview;
