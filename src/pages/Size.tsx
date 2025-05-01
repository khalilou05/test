import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import {
  setPaperSize,
  PAPER_SIZES,
} from '../store/productSlice';
import { addPosterToCart } from '../store/cartSlice';
import { EditorPreviewRef } from '../components/EditorPreview';
import { Radio, RadioGroup, Label, Field } from '@headlessui/react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { exportPdf } from '../utils/pdfUtils';
import { store } from '../store';
import { setZoomLevel } from '../store/zoomSlice';
import { Map as MapboxMap } from 'mapbox-gl';
import CartLoaderOverlay from '../components/CartLoaderOverlay';
import { useTranslation } from 'react-i18next';

interface SizeProps {
  editorPreviewRef: React.RefObject<EditorPreviewRef>;
}

// Helper pour générer un ID unique (identique à Overview)
const generateCartItemId = () => `cart-${Date.now()}-${Math.random().toString(16).substring(2, 8)}`;

// Nouvelle fonction helper pour attendre l'état idle de la carte
const waitForMapIdle = (map: MapboxMap, timeoutMs = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.warn(`Map idle timeout (${timeoutMs}ms)`);
      reject(new Error('Map did not become idle within the timeout period.'));
    }, timeoutMs);

    map.once('idle', () => {
      clearTimeout(timeoutId);
      console.log('Map is now idle.');
      resolve();
    });
     // Forcer un redimensionnement peut aider à déclencher l'idle
     setTimeout(() => map.resize(), 50); 
  });
};

const Size: React.FC<SizeProps> = ({ editorPreviewRef }) => {
  const dispatch: AppDispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  const productState = useSelector((state: RootState) => state.product);
  const { labels, points, layout, map, trace, profile, activities } = useSelector(
    (state: RootState) => ({
      labels: state.labels,
      points: state.points.points,
      layout: state.layout,
      map: state.map,
      trace: state.trace,
      profile: state.profile,
      activities: state.activities,
    })
  );

  const formatPrice = (price: number) => {
    return price.toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    });
  };

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const handleAddToCart = async () => {
    if (!editorPreviewRef.current || !editorPreviewRef.current.mapInstanceRef?.current) {
        console.error("EditorPreview ref or map instance is not available in Size page");
        alert("Erreur : Impossible d'accéder à l'éditeur ou à la carte.");
        return;
    }
    const mapInstance = editorPreviewRef.current.mapInstanceRef.current;
    
    const originalZoom = store.getState().zoom.selectedZoom;

    setIsAddingToCart(true);
    setIsGeneratingPreview(true);
    setUploadProgress(null);
    let thumbnailUrl: string | null = null;
    let pdfBlob: Blob | null = null;
    let exportSuccess = false;

    try {
        console.log("Forcing zoom to 100% for export (Size page)...");
        dispatch(setZoomLevel('100%'));

        console.log("Waiting briefly for React re-render after zoom change (Size page)...");
        await new Promise(resolve => setTimeout(resolve, 100)); 

        console.log("Waiting for map to become idle after zoom change (Size page)...");
        await waitForMapIdle(mapInstance);
        
        console.log("Map is idle, waiting a bit longer for final stabilization (Size page)...");
        await new Promise(resolve => setTimeout(resolve, 300)); // Délai supplémentaire de 300ms

        console.log("Proceeding with export generation (Size page)...");
        editorPreviewRef.current.containerRef?.current?.classList.add('is-exporting');

        // Génération Aperçu
        try {
            thumbnailUrl = await editorPreviewRef.current.generatePreviewImage();
            console.log("Aperçu généré (Size page, 100%):", thumbnailUrl ? "Succès" : "Échec");
        } catch (error) {
            console.error("Failed to generate preview image in Size page (at 100%):", error);
        } finally {
            setIsGeneratingPreview(false);
        }

        // Génération PDF
        console.log("Démarrage génération PDF via exportPdf à 100% (Size page)...");
        if (!editorPreviewRef.current?.containerRef || !editorPreviewRef.current?.mapContainerRef) {
            throw new Error("Références container ou mapContainer non trouvées pour l'export PDF.");
        }
        pdfBlob = await exportPdf(
            editorPreviewRef.current.containerRef, 
            editorPreviewRef.current.mapContainerRef, 
            editorPreviewRef.current.mapInstanceRef
        );
        if (!pdfBlob) {
            throw new Error("La génération du PDF a échoué (blob nul).");
        }
        console.log("PDF Blob généré avec succès à 100% (Size page).", pdfBlob);
        exportSuccess = true;

        // Upload et Ajout Panier si succès
        if (exportSuccess) {
            const cartItemId = generateCartItemId();
            console.log(`Generated Cart Item ID (Size page): ${cartItemId}. Début upload PDF...`);
            setUploadProgress(0);

            const formData = new FormData();
            formData.append('pdf', pdfBlob, `poster-${cartItemId}.pdf`);
            formData.append('cartItemId', cartItemId);

            await new Promise<void>((resolve, reject) => {
                 const xhr = new XMLHttpRequest();
                 xhr.open('POST', `${backendUrl}/api/upload-poster-pdf`, true);
                 xhr.upload.onprogress = (event) => {
                     if (event.lengthComputable) {
                         setUploadProgress(Math.round((event.loaded / event.total) * 100));
                     }
                 };
                 xhr.onload = () => {
                     setUploadProgress(100);
                     if (xhr.status >= 200 && xhr.status < 300) {
                         console.log(`Upload PDF pour ${cartItemId} réussi (Size page).`);
                         resolve();
                     } else {
                         reject(new Error(`Erreur serveur lors de l'upload: ${xhr.statusText || xhr.status}`));
                     }
                 };
                 xhr.onerror = () => reject(new Error('Erreur réseau lors de l\'upload.'));
                 xhr.send(formData);
             });

            console.log(`Ajout au panier local pour ${cartItemId} (Size page)...`);
            const currentProductConfig = {
                productType: productState.productType,
                selectedPaperSizeId: productState.selectedPaperSizeId,
                selectedPaperFinishId: productState.selectedPaperFinishId,
                selectedPaperWeightId: productState.selectedPaperWeightId,
                selectedFrameColorId: productState.selectedFrameColorId,
                price: productState.currentPrice,
            };
            const posterConfiguration = {
                labels,
                points,
                layout,
                map,
                trace,
                profile,
                product: currentProductConfig,
                activeActivityIds: activities.activeActivityIds,
                activitiesData: activities.activities,
            };
            dispatch(addPosterToCart({ 
                id: cartItemId, 
                configuration: posterConfiguration, 
                thumbnailUrl: thumbnailUrl ?? undefined 
            }));
            console.log('Poster ajouté au panier local (Size page): ', cartItemId);
            navigate('/cart');
        }

    } catch (error) {
        console.error('Erreur globale lors de l\'ajout au panier (Size page):', error);
        alert(`Une erreur s'est produite : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
        editorPreviewRef.current?.containerRef?.current?.classList.remove('is-exporting');
        console.log("Restoring original zoom level (Size page):", originalZoom);
        dispatch(setZoomLevel(originalZoom)); 
        setIsAddingToCart(false);
        setUploadProgress(null);
    }
  };

  return (
    <div className="space-y-6 p-1 text-white">
      {/* Overlay loader */}
      {isAddingToCart && <CartLoaderOverlay message={isGeneratingPreview ? t('size.generating_preview') : uploadProgress !== null ? t('size.upload_pdf', { progress: uploadProgress }) : t('size.adding_to_cart')} />}
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-lg font-semibold font-sans">{t('size.title')}</h1>
        <p className="text-gray-400 font-light text-sm">
          {t('size.subtitle')}
        </p>
      </div>

      {/* Paper Size */}
      <Field>
        <Label className="text-sm font-medium">{t('size.paper_size')}</Label>
        <RadioGroup
          value={productState.selectedPaperSizeId}
          onChange={(value: string) => dispatch(setPaperSize(value))}
          className="space-y-2 mt-3"
        >
          <div className="grid grid-cols-1 gap-2">
            {PAPER_SIZES.map((size) => (
              <Radio
                key={size.id}
                value={size.id}
                className={({ checked }) =>
                  clsx(
                    'cursor-pointer rounded-lg p-3 text-sm font-medium bg-white/5 flex justify-between items-center',
                    checked ? 'ring-2 ring-blue-500 bg-white/10' : 'hover:bg-white/10',
                    'focus:outline-none data-[focus]:outline-1 data-[focus]:outline-white'
                  )
                }
              >
                <span>
                  {size.name}{' '}
                  <span className="text-gray-400 text-xs">({size.dimensions})</span>
                </span>
              </Radio>
            ))}
          </div>
        </RadioGroup>
      </Field>

      {/* Total Price Display & Add to Cart */}
      <div className="pt-4 space-y-4">
        <div className="text-right text-lg font-semibold">
          {t('size.total')} {formatPrice(productState.currentPrice)}
        </div>
        <button
          onClick={handleAddToCart}
          disabled={isAddingToCart}
          className="w-full flex justify-center items-center space-x-2 bg-orange-500 hover:opacity-75 text-white py-2.5 rounded-sm text-sm font-medium transition duration-150 disabled:opacity-50 disabled:cursor-wait cursor-pointer"
        >
          {isAddingToCart ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {isGeneratingPreview 
                ? <span>{t('size.generating_preview')}</span> 
                : uploadProgress !== null 
                  ? <span>{t('size.upload_pdf', { progress: uploadProgress })}</span> 
                  : <span>{t('size.generating_pdf')}</span>}
            </>
          ) : (
            <span>{t('size.add_to_cart')}</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Size;