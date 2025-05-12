import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import {
  setMapStyle,
  setShowTerrain,
  setShowLabels,
  MAP_STYLE_OPTIONS,
  MapStyleOption,
} from '../store/mapSlice';
import { Radio, RadioGroup, Switch, Label, Field } from '@headlessui/react';
import clsx from 'clsx';
import { CheckIcon } from '@heroicons/react/20/solid'; // ou votre icône de coche
import { useTranslation } from 'react-i18next';
import { addPosterToCart } from '../store/cartSlice';
import CartLoaderOverlay from '../components/CartLoaderOverlay';
import { useNavigate } from 'react-router-dom';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

interface MapStyleProps {
  mapEditorRef: any;
}

const MapStyle: React.FC<MapStyleProps> = ({ mapEditorRef }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { selectedStyleId, showTerrain, showLabels } = useSelector(
    (state: RootState) => state.map
  );
  const selectedStyleInfo = MAP_STYLE_OPTIONS.find(s => s.id === selectedStyleId);
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

  const handleTerrainToggle = (enabled: boolean) => {
      // Assurez-vous que le style actuel supporte le terrain avant d'activer
      if (selectedStyleInfo?.hasTerrain) {
          dispatch(setShowTerrain(enabled));
      } else if (!enabled) {
          dispatch(setShowTerrain(false)); // Permettre de désactiver même si non supporté
      }
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
    <div className="space-y-6 p-1 text-white">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-lg font-semibold font-sans">{t('mapstyle.title')}</h1>
        <p className="text-gray-400 font-light text-sm">
          {t('mapstyle.subtitle')}
        </p>
      </div>

      {/* Map Style Selection */}
      <Field>
        <Label className="text-sm font-medium">{t('mapstyle.styles_label')}</Label>
        <RadioGroup
          value={selectedStyleId}
          onChange={(id: string) => dispatch(setMapStyle(id))}
          className="space-y-2 mt-3"
        >
          <div className="grid grid-cols-3 gap-2">
            {MAP_STYLE_OPTIONS.map((style: MapStyleOption) => {
              // Extract username and style_id from the mapbox URL
              const urlParts = style.url.replace('mapbox://styles/', '').split('/');
              const username = urlParts[0];
              const style_id = urlParts[1];

              // Construct the Mapbox Static Image API URL
              const thumbnailUrl = `https://api.mapbox.com/styles/v1/${username}/${style_id}/static/2.35,48.85,5,0,0/200x200?access_token=${MAPBOX_TOKEN}`;

              return (
                <Radio
                  key={style.id}
                  value={style.id}
                  className={({ checked }) => clsx(
                    'relative flex cursor-pointer rounded-lg p-1 focus:outline-none',
                    checked ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-blue-500' : 'ring-1 ring-white/10 hover:ring-white/30'
                  )}
                >
                    {({ checked }) => (
                        <>
                            <img
                                src={thumbnailUrl}
                                alt={style.name}
                                className="w-full h-auto object-cover rounded bg-gray-600"
                            />
                            {checked && (
                                <div className="absolute inset-0 rounded-lg ring-2 ring-inset ring-blue-500 flex items-center justify-center bg-black/30">
                                    <CheckIcon className="h-6 w-6 text-white" />
                                </div>
                            )}
                         </>
                    )}
                </Radio>
              );
            })}
          </div>
        </RadioGroup>
      </Field>

       {/* Toggles */}
       <div className="space-y-4 pt-4">
            {/* Terrain Toggle */}
            <Field className="flex items-center justify-between">
                <Label className="text-sm font-medium cursor-pointer" passive>
                    {t('mapstyle.terrain')}
                    {!selectedStyleInfo?.hasTerrain && <span className="text-xs text-gray-500 ml-1">({t('mapstyle.terrain_not_supported')})</span>}
                </Label>
                <Switch
                    checked={showTerrain && !!selectedStyleInfo?.hasTerrain}
                    onChange={handleTerrainToggle}
                    disabled={!selectedStyleInfo?.hasTerrain}
                    className={clsx(
                    'group relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900',
                    'data-[checked]:bg-blue-600 bg-gray-500',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                >
                    <span
                    aria-hidden="true"
                    className={clsx(
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                        'translate-x-0 data-[checked]:translate-x-5'
                    )}
                    />
                </Switch>
            </Field>

            {/* Labels Toggle */}
            <Field className="flex items-center justify-between">
                <Label className="text-sm font-medium cursor-pointer" passive>
                    {t('mapstyle.labels')}
                </Label>
                <Switch
                    checked={showLabels}
                    onChange={(val) => dispatch(setShowLabels(val))}
                    className={clsx(
                    'group relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900',
                    'data-[checked]:bg-blue-600 bg-gray-500'
                    )}
                >
                    <span
                    aria-hidden="true"
                    className={clsx(
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                        'translate-x-0 data-[checked]:translate-x-5'
                    )}
                    />
                </Switch>
            </Field>
       </div>

      {/* Bouton Ajouter au panier en bas, style identique à Overview */}
      {isAddingToCart && <CartLoaderOverlay message={t('overview.adding_to_cart')} />}
      <button
        onClick={handleAddToCart}
        disabled={isAddingToCart}
        className="w-full text-sm cursor-pointer flex justify-center items-center space-x-2 bg-orange-500 hover:opacity-75 text-white py-2 rounded-sm disabled:opacity-50 disabled:cursor-wait mt-8"
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

export default MapStyle;