import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { removeFromCart } from '../store/cartSlice';
import { HiTrash, HiOutlineShoppingBag } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { PAPER_FINISHES, PAPER_WEIGHTS, FRAME_COLORS } from '../store/productSlice';
import { MAP_STYLE_OPTIONS } from '../store/mapSlice';
import { CartItem } from '../store/cartSlice';
import { useTranslation } from 'react-i18next';

const Cart = () => {
  const dispatch: AppDispatch = useDispatch();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cartItems = useSelector((state: RootState) => state.cart.items);

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + item.posterConfiguration.product.price, 0);
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  };

  const getItemDetails = (config: CartItem['posterConfiguration']) => {
    const details = [];
    details.push(t('cart.format_a3'));
    const finish = PAPER_FINISHES.find(f => f.id === config.product.selectedPaperFinishId)?.name;
    if (finish) details.push(t('cart.finish', { finish }));
    const weight = PAPER_WEIGHTS.find(w => w.id === config.product.selectedPaperWeightId)?.name;
    if (weight) details.push(t('cart.weight', { weight }));
    const frame = FRAME_COLORS.find(f => f.id === config.product.selectedFrameColorId)?.name;
    if (config.product.productType === 'Framed poster' && frame) {
        details.push(t('cart.frame', { frame }));
    }
    if (config.layout.selectedLayoutId) details.push(t('cart.layout', { layout: config.layout.selectedLayoutId }));
    const mapStyleName = MAP_STYLE_OPTIONS.find(m => m.id === config.map.selectedStyleId)?.name;
    if (mapStyleName) details.push(t('cart.map_style', { style: mapStyleName }));
    return details.join(' · ');
  };

  return (
    <div className="space-y-6 p-4 md:p-6 text-white max-w-4xl mx-auto">
      <div className="space-y-1 mb-6">
        <h1 className="text-2xl font-semibold font-sans">{t('cart.title')}</h1>
        <p className="text-gray-400 font-light text-sm">
          {t('cart.subtitle')}
        </p>
      </div>

      {cartItems.length === 0 ? (
         <div className="text-center py-16 text-gray-400 bg-[#2a2a2a] rounded-md">
            <HiOutlineShoppingBag className="w-20 h-20 mx-auto mb-6 text-gray-500" />
            <p className="font-sans text-lg mb-4">{t('cart.empty')}</p>
            <button
              onClick={() => navigate('/')} 
              className="px-6 py-2.5 bg-[#333333] hover:bg-[#444444] text-white text-sm font-medium rounded-sm transition-colors duration-150 uppercase tracking-wider cursor-pointer"
            >
              {t('cart.start_creation')}
            </button>
         </div>
      ) : (
        <div className="space-y-5">
          {cartItems.map((item) => (
            <React.Fragment key={item.id}>
              <div className="flex flex-col bg-[#333333] rounded-sm shadow-lg overflow-hidden border border-gray-700 max-w-xs mx-auto">
                <div
                  className="w-full rounded-t-sm flex items-center justify-center py-5 bg-[#222]"
                  style={{
                    aspectRatio: "0.707",
                    minHeight: 120,
                    maxHeight: 260,
                  }}
                >
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={t('cart.poster_preview')}
                      className="w-full h-full object-contain rounded shadow"
                      style={{ background: '#222', maxHeight: 220 }}
                    />
                  ) : (
                    <span className="text-center text-xs text-gray-400">{t('cart.preview_unavailable')}</span>
                  )}
                </div>

                <div className="p-4 flex flex-col flex-grow min-h-[120px]">
                  <div
                    className="font-semibold font-sans text-base mb-1 truncate cart-item-title text-white"
                    style={{ maxWidth: '100%' }}
                    dangerouslySetInnerHTML={{ __html: item.posterConfiguration.labels.title.text || t('cart.custom_poster') }}
                  />

                  <div
                    className="text-xs text-gray-400 font-light leading-snug mb-3 cart-item-details truncate"
                    style={{ maxWidth: '100%' }}
                    dangerouslySetInnerHTML={{ __html: getItemDetails(item.posterConfiguration) }}
                  />

                  <div className="mt-auto pt-2 flex items-center justify-between">
                    <p className="text-base font-semibold font-sans text-orange-400">{formatPrice(item.posterConfiguration.product.price)}</p>

                    <button
                      onClick={() => dispatch(removeFromCart(item.id))}
                      className="text-gray-500 hover:text-red-500 transition-colors p-1 cursor-pointer"
                      aria-label={t('cart.remove_item')}
                    >
                      <HiTrash className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </React.Fragment>
          ))}

          <div className="pt-8 mt-8 border-t border-gray-600 space-y-5">
             <div className="flex justify-between items-center text-base font-semibold font-sans">
                <span>{t('cart.total')}</span>
                <span>{formatPrice(getTotalPrice())}</span>
             </div>
              <button
                onClick={() => navigate('/checkout')}
                className="w-full bg-orange-500 hover:opacity-85 text-white py-3 rounded-sm text-xs font-sans font-medium transition duration-150 uppercase tracking-wider shadow-md cursor-pointer"
            >
                {t('cart.checkout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;