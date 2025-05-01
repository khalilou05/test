import { useEffect, useState } from 'react';
import { HiCheckCircle, HiExclamationCircle } from 'react-icons/hi';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store';
import { removeItemsById, clearCart } from '../store/cartSlice';
import { FaDownload } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

// Interface pour typer la session Stripe récupérée (partielle)
interface StripeSessionLineItem {
    id: string;
    price?: {
        product?: {
            id: string;
            name?: string;
            metadata?: {
                cartItemId?: string;
            };
        };
    };
    quantity?: number;
    // ... autres propriétés de line item ...
}

interface StripeSession {
    id: string;
    payment_status: string;
    line_items?: {
        data: StripeSessionLineItem[];
    };
    // ... autres propriétés de session ...
}

interface VerifyPaymentResponse {
    isPaid: boolean;
    session?: StripeSession;
    error?: string;
    payment_status?: string;
}

// Nouvel état simplifié pour les items payés
interface PaidItemInfo {
    cartItemId: string;
    name?: string; // Nom du produit si disponible
    downloaded: boolean; // Pour griser le bouton après clic
}

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const Success = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch: AppDispatch = useDispatch();
  const { t } = useTranslation();
  // Supprimé: cartItemsFromRedux (plus besoin ici)
  const [isLoading, setIsLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'paid' | 'unpaid' | 'error'>('loading');
  // État simplifié : juste la liste des infos des items payés
  const [paidItems, setPaidItems] = useState<PaidItemInfo[]>([]); 
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  // Extraire session_id de l'URL au montage
  useEffect(() => {
      setSessionId(new URLSearchParams(location.search).get('session_id'));
  }, [location.search]);

  // Vérifier le statut du paiement quand sessionId est disponible
  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
          setIsLoading(false);
          setPaymentStatus('error');
          setErrorMessage('ID de session manquant.');
          return;
      }
      
      setIsLoading(true);
      setPaymentStatus('loading');
      setErrorMessage(null);
      setPaidItems([]); // Réinitialiser les items payés

      try {
        console.log(`Vérification du paiement pour la session: ${sessionId}`);
        const response = await fetch(`${backendUrl}/api/verify-payment/${sessionId}`);
        const data: VerifyPaymentResponse = await response.json();

        if (!response.ok || !data.isPaid || !data.session) {
          console.error('Échec de la vérification ou paiement non confirmé:', data);
          setPaymentStatus('unpaid');
          setErrorMessage(data.error || `Statut de paiement: ${data.payment_status || 'Inconnu'}`);
          throw new Error(data.error || 'Paiement non vérifié ou session invalide.');
        }
        
        console.log('Paiement vérifié avec succès. Session:', data.session);
        setPaymentStatus('paid');

        // Extraire les infos des line_items payés
        const itemsInfo = data.session.line_items?.data
          .map(item => ({
            cartItemId: item.price?.product?.metadata?.cartItemId,
            name: item.price?.product?.name,
            downloaded: false 
          }))
          .filter(info => typeof info.cartItemId === 'string')
          .map(info => info as PaidItemInfo) ?? []; 
        
        if (itemsInfo.length === 0) {
            console.warn("Aucun cartItemId trouvé dans les métadonnées de la session payée.", data.session);
            setPaymentStatus('error');
            setErrorMessage("Impossible de récupérer les détails de la commande.");
        } else {
            console.log("Infos des articles payés:", itemsInfo);
            
            // <-- MODIFICATION: Vider le panier Redux MAINTENANT -->
            const paidCartItemIds = itemsInfo.map(item => item.cartItemId);
            if (paidCartItemIds.length > 0) {
                console.log("Suppression des articles payés du panier Redux:", paidCartItemIds);
                dispatch(removeItemsById(paidCartItemIds));
            }
            // <-- FIN MODIFICATION -->

            // Mettre à jour l'état local pour l'affichage des boutons
            setPaidItems(itemsInfo);
        }

      } catch (error) {
        console.error('Erreur lors de la vérification du paiement:', error);
        if (paymentStatus !== 'unpaid') {
            setPaymentStatus('error');
            const specificErrorMessage = error instanceof Error ? error.message : 'Une erreur est survenue lors de la vérification.';
            setErrorMessage(specificErrorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    };

    verifyPayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, dispatch]); 

  // Après succès paiement, vider le panier Redux côté frontend (Success.tsx)
  useEffect(() => {
    if (paymentStatus === 'paid') {
      dispatch(clearCart()); // Action Redux à créer/importer si non existante
    }
  }, [paymentStatus, dispatch]);

  // --- Fonction de Téléchargement (simplifiée) --- 
  const handleDownload = (cartItemId: string) => {
    if (paymentStatus !== 'paid') {
      alert('Le paiement doit être validé avant de télécharger le PDF.');
      return;
    }
    console.log(`Téléchargement demandé pour ${cartItemId}`);
    window.open(`${backendUrl}/api/download-pdf/${cartItemId}`, '_blank');
    console.log(`Ouverture de l'URL de téléchargement lancée pour ${cartItemId}`);
    setTimeout(() => {
        setPaidItems(currentItems => 
            currentItems.map(item => 
                item.cartItemId === cartItemId ? { ...item, downloaded: true } : item
            )
        );
    }, 100); 
  };

  // ----- Rendu conditionnel (adapté) ----- 

  if (isLoading || paymentStatus === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-6 text-white">
        <div className="max-w-xl w-full bg-[#2a2a2a] p-8 rounded-lg shadow-xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-sm text-gray-300 mt-4">{t('success.processing')}</p>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-6 text-white">
        <div className="max-w-xl w-full bg-[#2a2a2a] p-8 rounded-lg shadow-xl">
          <HiExclamationCircle className="w-20 h-20 text-red-500 mx-auto mb-5" />
          <h1 className="text-xl font-semibold font-sans text-white mb-3">{t('success.error_title')}</h1>
          <p className="text-sm text-gray-200 font-light mb-6">
            {errorMessage || t('success.error_message')}
          </p>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'unpaid') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-6 text-white">
        <div className="max-w-xl w-full bg-[#2a2a2a] p-8 rounded-lg shadow-xl">
          <HiExclamationCircle className="w-20 h-20 text-yellow-500 mx-auto mb-5" /> 
          <h1 className="text-xl font-semibold font-sans text-white mb-3">{t('success.unpaid_title')}</h1>
          <p className="text-sm text-gray-200 font-light mb-6">
             {errorMessage || t('success.unpaid_message')}
          </p>
           <button
              onClick={() => navigate('/checkout')}
              className="mt-4 px-6 py-2.5 bg-[#333333] hover:bg-[#444444] text-white text-sm font-medium rounded-sm transition-colors duration-150 uppercase tracking-wider cursor-pointer"
            >
              {t('success.back_to_payment')}
            </button>
        </div>
      </div>
    );
  }

  // Si paymentStatus === 'paid'
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-6 text-white">
      <div className="max-w-xl w-full bg-[#2a2a2a] p-8 rounded-lg shadow-xl">
        <HiCheckCircle className="w-20 h-20 text-green-500 mx-auto mb-5" />
        <h1 className="text-xl font-semibold font-sans text-white mb-3">{t('success.paid_title')}</h1>
        <p className="text-sm text-gray-200 font-light mb-6">
          {t('success.paid_message')}
        </p>
        <div className="bg-[#333333] p-4 rounded-md mb-8 border border-gray-600/50 flex flex-col items-center space-y-3">
          <div className="w-full flex flex-row items-center justify-between gap-2 min-w-0 bg-[#26292f] border border-gray-500/30 rounded px-3 py-2">
            <span className="text-xs text-gray-300 font-medium">{t('success.order_reference')}</span>
            <button
              onClick={() => {
                if (sessionId) {
                  navigator.clipboard.writeText(sessionId);
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 1800);
                }
              }}
              className="p-1 rounded hover:bg-gray-600 transition flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-green-400"
              title={t('success.copy_reference')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="8" y="8" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2"/><rect x="4" y="4" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2"/></svg>
              <span className="sr-only">{t('success.copy_reference')}</span>
            </button>
          </div>
          {showToast && (
            <div className="absolute left-1/2 -translate-x-1/2 mt-3 bg-[#333b47] text-gray-100 text-xs px-4 py-2 rounded shadow-lg border border-gray-500/30 animate-fadein z-50">
              {t('success.reference_copied')}
            </div>
          )}
        </div>
        <div className="space-y-3">
          {paidItems.map((item, index) => {
            const isDisabled = item.downloaded; 
            const buttonText = item.downloaded ? t('success.download_again', { num: index + 1 }) : t('success.download', { num: index + 1 });
            const itemTitle = item.name || t('success.poster', { num: index + 1 });

            return (
              <button
                key={item.cartItemId}
                onClick={() => handleDownload(item.cartItemId)}
                title={itemTitle}
                className="w-full inline-flex items-center justify-center gap-2 px-8 py-2.5 bg-[#333333] hover:bg-[#3a3a3a] text-white text-xs font-medium font-sans rounded-sm transition duration-150 shadow-md hover:shadow-lg cursor-pointer border border-gray-600/50"
              >
                 <FaDownload className="w-3 h-3" />
                 <span>{buttonText}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Success;