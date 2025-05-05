import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { setLayoutState } from "../store/layoutSlice";
import { setLabelsState } from "../store/labelsSlice"; 
import { setPointsState } from "../store/pointsSlice";
import { StatLabel } from "../types/labels"; 
import { setMapState } from "../store/mapSlice";
import { setTraceState } from "../store/traceSlice"; 
import { setProfileState } from "../store/profileSlice"; 
import templates from "../templates/templates";
import { RootState } from "../store";
import { useTranslation } from 'react-i18next';
import { addPosterToCart } from '../store/cartSlice';
import CartLoaderOverlay from '../components/CartLoaderOverlay';
import { useNavigate } from 'react-router-dom';


interface TemplatePageProps {
  mapEditorRef: any;
}

const TemplatePage: React.FC<TemplatePageProps> = ({ mapEditorRef }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const currentTrace = useSelector((state: RootState) => state.trace);
  const currentPoints = useSelector((state: RootState) => state.points);
  const [isAddingToCart, setIsAddingToCart] = React.useState(false);
  const navigate = useNavigate();
  const labels = useSelector((state: RootState) => state.labels);
  const points = useSelector((state: RootState) => state.points.points);
  const layout = useSelector((state: RootState) => state.layout);
  const map = useSelector((state: RootState) => state.map);
  const trace = useSelector((state: RootState) => state.trace);
  const profile = useSelector((state: RootState) => state.profile);
  const product = useSelector((state: RootState) => state.product);
  const activities = useSelector((state: RootState) => state.activities.activities);
  const activeActivityIds = useSelector((state: RootState) => state.activities.activeActivityIds);

  const handleApplyTemplate = (template: any) => {
    dispatch(setLayoutState(template.layout));
    // Correction de la structure pour LabelsState attendu par le store
    const mergedLabels = {
      title: {
        text: template.labels?.title?.text || '',
        isVisible: template.labels?.title?.isVisible ?? true,
        style: template.labels?.title?.style || {},
      },
      description: {
        text: template.labels?.description?.text || '',
        isVisible: template.labels?.description?.isVisible ?? true,
        style: template.labels?.description?.style || {},
      },
      stats: Array.isArray(template.labels?.stats) ? template.labels.stats.map((stat: StatLabel) => ({
        label: stat.label || '',
        value: stat.value || '',
        style: stat.style || {},
      })) : [],
    };
    dispatch(setLabelsState(mergedLabels)); 

    // 1. Changer la couleur et le style du trace
    dispatch(setTraceState({ ...currentTrace, ...template.trace }));

    // 2. Appliquer tout le style des marqueurs/points (par index)
    const newPoints = {
      ...currentPoints,
      points: currentPoints.points.map((pt: any, idx: number) => {
        const templatePt = template.points?.points?.[idx];
        if (templatePt && templatePt.style) {
          return {
            ...pt,
            style: {
              ...pt.style,
              ...templatePt.style, // Copie toutes les propriétés de style du marker
            },
          };
        }
        return pt;
      }),
    };
    dispatch(setPointsState(newPoints)); 

    dispatch(setMapState(template.map));
    dispatch(setProfileState(template.profile)); 
  };

  const handleAddToCart = async () => {
    if (!mapEditorRef?.current || !mapEditorRef.current.generatePreviewImage) {
      alert("Erreur : Impossible d'accéder à l'éditeur ou à la carte pour générer l'aperçu.");
      return;
    }
    setIsAddingToCart(true);
    try {
      const thumbnailUrl = await mapEditorRef.current.generatePreviewImage();
      const { currentPrice: _, ...productDetails } = product;
      const productForCart = {
        ...productDetails,
        price: product.currentPrice,
      };
      const posterConfiguration = {
        labels,
        points,
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
    <div className="flex flex-col w-full h-full bg-gray-900 rounded-lg shadow-lg overflow-hidden">
      {/* En-tête de la page */}
      <div className="space-y-1 px-2 pt-6 pb-4">
        <h1 className="text-lg font-semibold font-sans text-white">
          {t('template.title')}
        </h1>
        <p className="text-gray-400 font-light text-sm">
          {t('template.subtitle')}
        </p>
      </div>
      <div className="w-full mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 w-full">
          {templates.map((template, idx) => (
            <button
              key={idx}
              type="button"
              className="group flex flex-col items-center transition-none scale-100 cursor-pointer overflow-hidden relative border-0 w-full h-[221px] bg-transparent p-0 m-0 template-hover"
              style={{height:221, background:'none', padding:0, margin:0}}
              onClick={() => handleApplyTemplate(template)}
            >
              <img
                src={template.preview}
                alt={t('template.preview_alt')}
                title={t('template.preview_title')}
                width={156}
                height={156}
                loading="lazy"
                decoding="async"
                className="object-cover rounded"
                style={{ color: "transparent" }}
              />
            </button>
          ))}
        </div>
      </div>
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

export default TemplatePage;