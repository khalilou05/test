import clsx from "clsx";
import { RootState } from "../store";
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import {
  addPoint,
  setPointVisibility,
  setSelectedPointId,
  initializePoints,
  Point,
} from "../store/pointsSlice";

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";

import {
  FaEdit,
  FaTrash,
  FaArrowLeft,
  FaMapMarkerAlt,
} from "react-icons/fa"; // Icons from react-icons

import PointEditor from "../components/PointEditor";
import { useTranslation } from 'react-i18next';
import { addPosterToCart } from '../store/cartSlice';
import CartLoaderOverlay from '../components/CartLoaderOverlay';
import { useNavigate } from 'react-router-dom';

interface PointsProps {
  mapEditorRef: any;
}

const Points: React.FC<PointsProps> = ({ mapEditorRef }) => {
  const dispatch = useDispatch();
  const allPointsFromState = useSelector((state: RootState) => state.points.points);
  const selectedPointId = useSelector(
    (state: RootState) => state.points.selectedPointId
  );
  const activities = useSelector((state: RootState) => state.activities.activities);
  const activeActivityIds = useSelector((state: RootState) => state.activities.activeActivityIds);
  const [selectedAvailablePoint, setSelectedAvailablePoint] = useState<
    string | null
  >(null);
  const { t } = useTranslation();
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const navigate = useNavigate();
  const labels = useSelector((state: RootState) => state.labels);
  const layout = useSelector((state: RootState) => state.layout);
  const map = useSelector((state: RootState) => state.map);
  const trace = useSelector((state: RootState) => state.trace);
  const profile = useSelector((state: RootState) => state.profile);
  const product = useSelector((state: RootState) => state.product);

  useEffect(() => {
    console.log("[Points.tsx] All points from Redux state:", allPointsFromState.length, JSON.stringify(allPointsFromState, null, 2));
    console.log("[Points.tsx] Active Activity IDs:", activeActivityIds);

    // Recalculate displayedPoints here for logging clarity
    const currentDisplayedPoints = allPointsFromState.filter(
      (point: Point) => activeActivityIds.includes(point.activityId) && point.isVisible
    );
    console.log("[Points.tsx] Calculated displayedPoints:", currentDisplayedPoints.length, JSON.stringify(currentDisplayedPoints, null, 2));

  }, [allPointsFromState, activeActivityIds]); // Log whenever the source data changes

  useEffect(() => {
    // Filtrer les activités actives
    const activeActivities = activities.filter((activity) =>
      activeActivityIds.includes(activity.id)
    );

    // Initialiser les points uniquement pour les activités actives
    dispatch(initializePoints(activeActivities));

    // Supprimer les points des activités supprimées
    allPointsFromState.filter(point => !activities.some(activity => activity.id === point.activityId)).forEach(point => {
      dispatch(setPointVisibility({ id: point.id, isVisible: false }));
    });
  }, [dispatch, activities, activeActivityIds, activities.length]); // Add activities.length here

  const handleDeletePoint = (id: string) => {
    dispatch(setPointVisibility({ id: id, isVisible: false }));
  };

  const handleAddPoint = (id: string) => {
    dispatch(addPoint(id));
    dispatch(setPointVisibility({ id: id, isVisible: true }));
    setSelectedAvailablePoint(null); // Reset selected value after adding
  };

  const handleSelectPoint = (id: string) => {
    dispatch(setSelectedPointId(id));
  };

  const handleReturnToList = () => {
    dispatch(setSelectedPointId(null));
  };

  const unvisiblePoints = allPointsFromState.filter(
    (point: Point) => !point.isVisible && activeActivityIds.includes(point.activityId)
  );

  // Calculate displayedPoints for rendering (using the same logic as the logger)
  const displayedPoints = allPointsFromState.filter(
    (point: Point) => activeActivityIds.includes(point.activityId) && point.isVisible
  );

  const handleAddToCart = async () => {
    if (!mapEditorRef?.current || !mapEditorRef.current.generatePreviewImage) {
      alert("Erreur : Impossible d'accéder à l'éditeur ou à la carte pour générer l'aperçu.");
      return;
    }
    setIsAddingToCart(true);
    try {
      // Générer l'aperçu de la carte
      const thumbnailUrl = await mapEditorRef.current.generatePreviewImage();
      const { currentPrice: _, ...productDetails } = product;
      const productForCart = {
        ...productDetails,
        price: product.currentPrice,
      };
      const posterConfiguration = {
        labels,
        points: allPointsFromState,
        layout,
        map,
        trace,
        profile,
        product: productForCart,
        activeActivityIds,
        activitiesData: activities,
      };
      dispatch(addPosterToCart({
        id: `cart-${Date.now()}-${Math.random().toString(16).substring(2, 8)}`,
        configuration: posterConfiguration,
        thumbnailUrl: thumbnailUrl ?? undefined,
      }));
      navigate('/cart');
    } catch (error) {
      alert("Erreur lors de l'ajout au panier");
    } finally {
      setIsAddingToCart(false);
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-md mx-auto md:max-w-none">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-lg font-semibold font-sans text-white">
          {t('points.title')}
        </h1>
        <p className="text-gray-400 font-light text-sm">
          {t('points.subtitle')}
        </p>
      </div>

      {/* Conditionnellement afficher l'éditeur ou la liste */}
      {selectedPointId ? (
        /* Éditeur de point (affiché seul) */
        <div className="space-y-8">
          <button
            onClick={handleReturnToList}
            className="inline-flex items-center text-white hover:opacity-75 cursor-pointer transition duration-150 ease-in-out"
          >
            <FaArrowLeft className="mr-2" /> {t('points.back_to_list')}
          </button>
          <PointEditor pointId={selectedPointId} mapEditorRef={mapEditorRef} />
        </div>
      ) : (
        /* Liste des points (masquée lors de l'édition) */
        <div className="space-y-3">
          {/* Top Bar (Select All, Delete, Add) */}
          <div className="flex items-center justify-between">
            <div className="text-white font-medium">
              {t('points.points')} ({displayedPoints.length})
            </div>

            <div className="flex items-center space-x-2">
              {/* Delete Button */}
              <button
                onClick={() =>
                  displayedPoints
                    .filter((point) => point.isVisible)
                    .forEach((point) => handleDeletePoint(point.id))
                }
                className="flex flex-col items-center justify-center p-2 rounded-md bg-[#333] h-8 w-8 hover:opacity-75 cursor-pointer text-gray-400 hover:text-white transition duration-150 ease-in-out"
                title={t('points.delete_all')}
                disabled={
                  displayedPoints.filter((point) => point.isVisible).length ===
                  0
                }
              >
                <FaTrash className="h-3 w-3" />
              </button>

              {/* Add Button (Ajouter un point) */}
              <div className="w-38">
                <Listbox
                  value={selectedAvailablePoint}
                  onChange={handleAddPoint}
                >
                  <ListboxButton
                    className={clsx(
                      "relative block w-full rounded-lg bg-[#333] py-1.5 pr-8 pl-3 text-left text-sm/6 text-white",
                      "focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25"
                    )}
                  >
                    <span className="block truncate">
                      {selectedAvailablePoint
                        ? allPointsFromState.find((p) => p.id === selectedAvailablePoint)
                            ?.name
                        : t('points.add_point')}
                    </span>
                    <ChevronDownIcon
                      className="group pointer-events-none absolute top-2.5 right-2.5 size-4 fill-white/60"
                      aria-hidden="true"
                    />
                  </ListboxButton>
                  {unvisiblePoints.length > 0 && (
                    <ListboxOptions
                      anchor="bottom"
                      transition
                      className={clsx(
                        "w-[var(--button-width)] z-50 mt-1 rounded-xl border border-white/5 bg-[#333] p-1 [--anchor-gap:var(--spacing-1)] focus:outline-none",
                        "transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
                      )}
                    >
                      {unvisiblePoints.map((point) => (
                        <ListboxOption
                          key={point.id}
                          value={point.id}
                          className="group flex cursor-default items-center gap-2 rounded-lg py-1.5 px-3 select-none data-[focus]:bg-white/10"
                        >
                          <div className="text-sm/6 text-white">
                            {point.name}
                          </div>
                        </ListboxOption>
                      ))}
                    </ListboxOptions>
                  )}
                </Listbox>
              </div>
            </div>
          </div>

          {/* Liste des points */}
          <div className="flex flex-col space-y-2">
            {displayedPoints.length > 0 &&
              displayedPoints.map((point, index) => (
                <div
                  key={point.id}
                  className={`flex items-center space-x-3 py-2.5 px-3 rounded-md transition duration-150 ease-in-out cursor-pointer border border-gray-700/50 hover:bg-gray-700/50`}
                  onClick={() => handleSelectPoint(point.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") &&
                    handleSelectPoint(point.id)
                  }
                >
                  <div className="flex-shrink-0 w-7 h-7 bg-gray-600 flex items-center justify-center rounded-sm text-gray-400">
                    <FaMapMarkerAlt className="w-4 h-4" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <p
                        className="text-white font-medium text-sm truncate"
                        title={point.name}
                      >
                        {index + 1}. {point.name}
                      </p>
                    </div>
                    <p className="text-gray-400 text-xs text-left">
                      {t('points.activity')}: {activities.find((act) => act.id === point.activityId)
                        ?.name || t('points.unnamed_activity')}
                    </p>
                    <p className="text-gray-400 text-xs text-left">
                      {t('points.coordinates')}: {point.coordinate?.[0]?.toFixed(5)}, {point.coordinate?.[1]?.toFixed(5)}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPoint(point.id);
                      }}
                      className="flex-shrink-0 p-1 w-7 h-7 flex flex-col items-center justify-center cursor-pointer rounded-full text-gray-500 hover:text-blue-500 hover:bg-gray-700 transition duration-150 ease-in-out"
                      aria-label={t('points.edit_aria', { name: point.name })}
                      title={t('points.edit_title')}
                    >
                      <FaEdit className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePoint(point.id);
                      }}
                      className="flex-shrink-0 p-1 w-7 h-7 flex flex-col items-center justify-center cursor-pointer rounded-full text-gray-500 hover:text-red-500 hover:bg-gray-700 transition duration-150 ease-in-out"
                      aria-label={t('points.delete_aria', { name: point.name })}
                      title={t('points.delete_title')}
                    >
                      <FaTrash className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
      {/* Bouton Ajouter au panier en bas */}
      {isAddingToCart && <CartLoaderOverlay message={t('overview.adding_to_cart')} />}
      <button
        onClick={handleAddToCart}
        disabled={isAddingToCart}
        className="w-full text-sm cursor-pointer flex justify-center items-center space-x-2 bg-orange-500 hover:opacity-75 text-white py-2 rounded-sm disabled:opacity-50 disabled:cursor-wait mt-8"
        style={{ position: 'sticky', bottom: 0, left: 0 }}
      >
        {isAddingToCart ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{t('overview.adding_to_cart')}</span>
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
            <span>{t('overview.add_to_cart')}</span>
          </>
        )}
      </button>
    </div>
  );
};

export default Points;