import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Card } from '../../components/Card';
import { Spinner } from '../../components/Spinner';
// @ts-ignore
import Quagga from 'quagga';

interface PalletInfo {
  id: string;
  receptionId: string;
  clientId: string;
  clientName: string;
  totalCrates: number;
  cratesPerPallet: number;
  customPalletCrates: Record<number, number>;
  pallets: Array<{
    number: number;
    crates: number;
    isFull: boolean;
    reference: string;
  }>;
  createdAt: any;
  updatedAt: any;
}

interface ReceptionInfo {
  id: string;
  clientName: string;
  productName: string;
  productVariety: string;
  roomName: string;
  arrivalTime: any;
  crateCount: number;
}

const PalletScannerPage: React.FC = () => {
  const { t } = useTranslation();
  const hookTenantId = useTenantId();
  const tenantId = hookTenantId || 'YAZAMI'; // Fallback to hardcoded value
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string>('');
  const [palletInfo, setPalletInfo] = useState<PalletInfo | null>(null);
  const [receptionInfo, setReceptionInfo] = useState<ReceptionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const videoRef = useRef<HTMLDivElement>(null);

  // Start camera for barcode scanning
  const startCamera = async () => {
    try {
      setIsScanning(true);
      setError('');
      
      // Initialize QuaggaJS
      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: videoRef.current,
          constraints: {
            width: { min: 640 },
            height: { min: 480 },
            facingMode: "environment",
            aspectRatio: { min: 1, max: 2 }
          },
        },
        locator: {
          patchSize: "medium",
          halfSample: true,
        },
        numOfWorkers: 2,
        frequency: 10,
        decoder: {
          readers: [
            "code_128_reader",
            "ean_reader",
            "ean_8_reader",
            "code_39_reader",
            "code_39_vin_reader",
            "codabar_reader",
            "upc_reader",
            "upc_e_reader",
            "i2of5_reader"
          ],
        },
        locate: true,
      }, (err: any) => {
        if (err) {
          console.error('QuaggaJS initialization error:', err);
          setError('Erreur lors de l\'initialisation du scanner. Veuillez réessayer.');
          setIsScanning(false);
          return;
        }
        console.log("QuaggaJS initialization finished. Ready to start");
        Quagga.start();
      });

      // Listen for successful barcode detection
      Quagga.onDetected((result: any) => {
        const code = result.codeResult.code;
        console.log('Barcode detected:', code);
        setScannedCode(code);
        stopCamera();
        searchPallet(code);
      });

    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Impossible d\'accéder à la caméra. Veuillez autoriser l\'accès à la caméra.');
      setIsScanning(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    try {
      Quagga.stop();
    } catch (err) {
      console.log('QuaggaJS was not running');
    }
    setIsScanning(false);
  };

  // Manual code input
  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScannedCode(e.target.value);
  };

  // Search for pallet by reference
  const searchPallet = async (reference: string) => {
    if (!reference.trim()) return;

    if (!tenantId) {
      setError('Erreur: ID du tenant non disponible. Veuillez rafraîchir la page.');
      return;
    }

    setLoading(true);
    setError('');
    setPalletInfo(null);
    setReceptionInfo(null);

    try {
      console.log('Searching for pallet with reference:', reference, 'tenantId:', tenantId);
      
      // Search in pallet-collections collection
      const palletQuery = query(
        collection(db, 'pallet-collections'),
        where('tenantId', '==', tenantId)
      );
      
      const palletSnapshot = await getDocs(palletQuery);
      console.log('Found', palletSnapshot.docs.length, 'pallet collections');
      
      // Debug: Log all available pallet collections
      palletSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`Collection ${index + 1}:`, {
          id: doc.id,
          tenantId: data.tenantId,
          receptionId: data.receptionId,
          clientName: data.clientName,
          totalCrates: data.totalCrates,
          palletsCount: data.pallets?.length || 0,
          palletReferences: data.pallets?.map(p => p.reference) || []
        });
      });
      
      let foundPallet: PalletInfo | null = null;

      // Look for pallet with matching reference
      for (const docSnapshot of palletSnapshot.docs) {
        const data = docSnapshot.data() as PalletInfo;
        console.log('Checking collection:', docSnapshot.id, 'pallets:', data.pallets?.length);
        
        if (data.pallets && Array.isArray(data.pallets)) {
          const matchingPallet = data.pallets.find((p: { reference: string }) => p.reference === reference);
          if (matchingPallet) {
            console.log('Found matching pallet:', matchingPallet);
            foundPallet = { ...data, id: docSnapshot.id };
            break;
          }
        }
      }

      if (foundPallet) {
        setPalletInfo(foundPallet);
        
        // Get reception information
        try {
          const receptionDoc = await getDoc(doc(db, 'tenants', tenantId, 'receptions', foundPallet.receptionId));
          if (receptionDoc.exists()) {
            const receptionData = receptionDoc.data() as ReceptionInfo;
            setReceptionInfo({ ...receptionData, id: receptionDoc.id });
            console.log('Found reception info:', receptionData);
          } else {
            console.log('Reception not found for ID:', foundPallet.receptionId);
            setError('Informations de réception non trouvées pour cette palette.');
          }
        } catch (receptionErr) {
          console.error('Error fetching reception:', receptionErr);
          setError('Erreur lors de la récupération des informations de réception.');
        }
      } else {
        console.log('No pallet found with reference:', reference);
        setError('Palette non trouvée. Vérifiez le code-barres et réessayez.');
      }
    } catch (err) {
      console.error('Error searching for pallet:', err);
      if (err instanceof Error) {
        setError(`Erreur lors de la recherche de la palette: ${err.message}`);
      } else {
        setError('Erreur lors de la recherche de la palette.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchPallet(scannedCode);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Debug logging
  console.log('PalletScannerPage render - tenantId:', tenantId);

  // Show loading if tenantId is not available
  if (!tenantId) {
    console.log('TenantId not available, showing loading...');
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="mt-4 text-gray-600">Chargement des données...</p>
            <p className="mt-2 text-sm text-gray-500">En attente de l'ID du tenant...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          {t('scanner.title', 'Scanner de Palette')}
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          {t('scanner.description', 'Scannez le code-barres d\'une palette pour voir ses informations')}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        {/* Scanner Section */}
        <Card className="p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">
            {t('scanner.scanSection', 'Scanner')}
          </h2>
          
          {!isScanning ? (
            <div className="text-center py-6 md:py-8">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 md:w-8 md:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <button
                onClick={startCamera}
                className="px-4 md:px-6 py-2 md:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm md:text-base"
              >
                {t('scanner.startCamera', 'Démarrer la caméra')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <div
                  ref={videoRef}
                  className="w-full h-48 md:h-64 bg-gray-900 rounded-lg"
                  style={{ position: 'relative' }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-32 h-24 md:w-48 md:h-32 border-2 border-green-500 rounded-lg bg-transparent">
                    <div className="absolute top-0 left-0 w-4 h-4 md:w-6 md:h-6 border-t-2 border-l-2 border-green-500"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 md:w-6 md:h-6 border-t-2 border-r-2 border-green-500"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 md:w-6 md:h-6 border-b-2 border-l-2 border-green-500"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 md:w-6 md:h-6 border-b-2 border-r-2 border-green-500"></div>
                  </div>
                </div>
                <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                  {String(t('scanner.pointCamera', 'Pointez la caméra vers le code-barres'))}
                </div>
              </div>
              
              <button
                onClick={stopCamera}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm md:text-base"
              >
                {t('scanner.stopCamera', 'Arrêter la caméra')}
              </button>
            </div>
          )}

          {/* Manual Input */}
          <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-200">
            <h3 className="text-base md:text-lg font-medium text-gray-900 mb-3">
              {t('scanner.manualInput', 'Saisie manuelle')}
            </h3>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={scannedCode}
                onChange={handleManualInput}
                placeholder={String(t('scanner.enterCode', 'Entrez le code de la palette'))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm md:text-base"
              />
              <button
                type="submit"
                disabled={loading || !scannedCode.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm md:text-base whitespace-nowrap"
              >
                {loading ? <Spinner size="sm" /> : t('scanner.search', 'Rechercher')}
              </button>
            </form>
          </div>
        </Card>

        {/* Results Section */}
        <Card className="p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">
            {t('scanner.results', 'Résultats')}
          </h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {palletInfo && receptionInfo && (
            <div className="space-y-4">
              {/* Pallet Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t('scanner.palletInfo', 'Informations de la palette')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Référence:</span>
                    <span className="ml-2 font-medium">{scannedCode}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Client:</span>
                    <span className="ml-2 font-medium">{receptionInfo.clientName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Produit:</span>
                    <span className="ml-2 font-medium">{receptionInfo.productName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Variété:</span>
                    <span className="ml-2 font-medium">{receptionInfo.productVariety}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Chambre:</span>
                    <span className="ml-2 font-medium">{receptionInfo.roomName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <span className="ml-2 font-medium">
                      {receptionInfo.arrivalTime?.toDate?.()?.toLocaleDateString('fr-FR') || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pallet Details */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t('scanner.palletDetails', 'Détails de la palette')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Caisses:</span>
                    <span className="ml-2 font-medium">
                      {palletInfo.pallets?.find(p => p.reference === scannedCode)?.crates || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <span className="ml-2 font-medium">
                      {palletInfo.pallets?.find(p => p.reference === scannedCode)?.isFull ? 'Complète' : 'Partielle'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total caisses:</span>
                    <span className="ml-2 font-medium">{palletInfo.totalCrates}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Caisses/palette:</span>
                    <span className="ml-2 font-medium">{palletInfo.cratesPerPallet}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <button
                  onClick={() => {
                    setPalletInfo(null);
                    setReceptionInfo(null);
                    setScannedCode('');
                    setError('');
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm md:text-base"
                >
                  {t('scanner.clear', 'Effacer')}
                </button>
                <button
                  onClick={() => searchPallet(scannedCode)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm md:text-base"
                >
                  {t('scanner.refresh', 'Actualiser')}
                </button>
              </div>
            </div>
          )}

          {!palletInfo && !error && !loading && (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>{t('scanner.noData', 'Aucune donnée à afficher')}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PalletScannerPage;
