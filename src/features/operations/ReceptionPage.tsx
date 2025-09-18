import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { EnhancedSelect } from '../../components/EnhancedSelect';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, Timestamp, query, where, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { useAppSettings } from '../../lib/hooks/useAppSettings';
import { logCreate, logUpdate, logDelete } from '../../lib/logging';
import QRCode from 'qrcode';

// QRCode is now imported locally

interface Client {
  id: string;
  name: string;
  phone: string;
  company: string;
  reservedCrates?: number;
  requiresEmptyCrates?: boolean;
}

interface EmptyCrateLoan {
  id: string;
  clientId: string;
  crates: number;
  status: 'open' | 'returned';
}

interface Truck {
  id: string;
  number: string;
  color?: string;
  photoUrl?: string;
  isActive: boolean;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  isActive: boolean;
}

interface Product {
  id: string;
  name: string;
  variety: string;
  imageUrl?: string;
  isActive: boolean;
}

interface Room {
  id: string;
  room: string;
  capacity: number;
  capacityCrates?: number;
  capacityPallets?: number;
  sensorId: string;
  active: boolean;
}

interface Reception {
  id: string;
  serial: string; // Serial unique pour le ticket
  clientId: string;
  clientName: string;
  truckId: string;
  truckNumber: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  productId: string;
  productName: string;
  productVariety: string;
  roomId?: string;
  roomName?: string;
  totalCrates: number;
  arrivalTime: Date;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  createdAt: Date;
}

// Fonction pour générer un serial unique
const generateSerial = (): string => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const time = now.getTime().toString().slice(-6);
  return `REC${year}${month}${day}${time}`;
};

// Fonction de fallback pour l'impression
const printTicketInCurrentWindow = (reception: Reception, ticketNumber: string, qrUrl: string, currentDate: Date) => {
  const printContent = `
    <div style="font-family: 'Courier New', monospace; font-size: 10px; width: 80mm; margin: 0 auto; padding: 2mm; border: 1px solid #000;">
      <div style="text-align: center; border-bottom: 1px solid #000; padding-bottom: 3mm; margin-bottom: 3mm;">
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 1mm; letter-spacing: 1px;">Domaine LYAZAMI</div>
        <div style="font-size: 12px; font-weight: bold; margin-bottom: 1mm;">BON DE SORTIE</div>
        <div style="font-size: 10px; color: #666; margin-bottom: 2mm;">N° ${ticketNumber}</div>
      </div>
      
      <div style="margin: 2mm 0; border: 1px solid #000; padding: 2mm;">
        <div style="font-weight: bold; font-size: 10px; margin-bottom: 1mm; text-decoration: underline; text-transform: uppercase;">INFORMATIONS</div>
        <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
          <span style="font-weight: bold; flex: 1;">Date:</span>
          <span style="text-align: right; flex: 1; font-weight: normal;">${reception.arrivalTime.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
          <span style="font-weight: bold; flex: 1;">Heure:</span>
          <span style="text-align: right; flex: 1; font-weight: normal;">${reception.arrivalTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      
      <div style="margin: 2mm 0; border: 1px solid #000; padding: 2mm;">
        <div style="font-weight: bold; font-size: 10px; margin-bottom: 1mm; text-decoration: underline; text-transform: uppercase;">CLIENT</div>
        <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
          <span style="font-weight: bold; flex: 1;">Nom:</span>
          <span style="text-align: right; flex: 1; font-weight: normal;">${reception.clientName}</span>
        </div>
      </div>
      
      <div style="margin: 2mm 0; border: 1px solid #000; padding: 2mm;">
        <div style="font-weight: bold; font-size: 10px; margin-bottom: 1mm; text-decoration: underline; text-transform: uppercase;">TRANSPORT</div>
        <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
          <span style="font-weight: bold; flex: 1;">Camion:</span>
          <span style="text-align: right; flex: 1; font-weight: normal;">${reception.truckNumber}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
          <span style="font-weight: bold; flex: 1;">Chauffeur:</span>
          <span style="text-align: right; flex: 1; font-weight: normal;">${reception.driverName}</span>
        </div>
        ${reception.driverPhone ? `
        <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
          <span style="font-weight: bold; flex: 1;">Tel:</span>
          <span style="text-align: right; flex: 1; font-weight: normal;">${reception.driverPhone}</span>
        </div>
        ` : ''}
      </div>
      
      <div style="margin: 2mm 0; border: 1px solid #000; padding: 2mm;">
        <div style="font-weight: bold; font-size: 10px; margin-bottom: 1mm; text-decoration: underline; text-transform: uppercase;">PRODUIT</div>
        <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
          <span style="font-weight: bold; flex: 1;">Type:</span>
          <span style="text-align: right; flex: 1; font-weight: normal;">${reception.productName}</span>
        </div>
        ${reception.productVariety ? `
        <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
          <span style="font-weight: bold; flex: 1;">Variété:</span>
          <span style="text-align: right; flex: 1; font-weight: normal;">${reception.productVariety}</span>
        </div>
        ` : ''}
      </div>
      
      ${reception.roomName ? `
      <div style="margin: 2mm 0; border: 1px solid #000; padding: 2mm;">
        <div style="font-weight: bold; font-size: 10px; margin-bottom: 1mm; text-decoration: underline; text-transform: uppercase;">CHAMBRE</div>
        <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
          <span style="font-weight: bold; flex: 1;">Chambre:</span>
          <span style="text-align: right; flex: 1; font-weight: normal;">${reception.roomName}</span>
        </div>
      </div>
      ` : ''}
      
      <div style="background-color: #000; color: white; padding: 1mm 2mm; font-weight: bold; text-align: center; margin: 1mm 0;">
        <div style="text-align: center;">CAISSES: ${reception.totalCrates}</div>
      </div>
      
      <div style="text-align: center; margin: 2mm 0; padding: 2mm; border: 1px dashed #000;">
        <div style="text-align: center; font-size: 8px; margin-bottom: 1mm;">Code de suivi</div>
        <div style="text-align: center; font-family: monospace; font-size: 10px; font-weight: bold;">${ticketNumber}</div>
        <div style="text-align: center; margin-top: 2mm;">
          <div id="qrcode-fallback" style="display: inline-block;"></div>
        </div>
      </div>
      
      <script>
        // Generate QR code for fallback
        (function() {
          const qrElement = document.getElementById('qrcode-fallback');
          
          if (typeof QRCode !== 'undefined' && qrElement) {
            QRCode.toCanvas(qrElement, '${qrUrl}', {
              width: 80,
              height: 80,
              margin: 1,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            }, function (error) {
              if (error) {
                console.error('Erreur génération QR code fallback:', error);
                qrElement.innerHTML = '<div style="font-size: 8px; color: #666;">QR: ${qrUrl}</div>';
              }
            });
          } else {
            if (qrElement) {
              qrElement.innerHTML = '<div style="font-size: 8px; color: #666;">QR: ${qrUrl}</div>';
            }
          }
        })();
      </script>
      
      <div style="text-align: center; margin: 2mm 0; font-size: 8px;">═══════════════════════════════</div>
      
      <div style="border-bottom: 1px solid #000; margin: 2mm 0; height: 8mm;">
        <div style="display: flex; justify-content: space-between; margin-top: 1mm; font-size: 8px;">
          <span>Chauffeur:</span>
          <span>Responsable:</span>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 3mm; font-size: 8px; color: #666; border-top: 1px solid #000; padding-top: 2mm;">
        <div> Domaine LYAZAMI</div>
        <div>${currentDate.toLocaleDateString('fr-FR')} ${currentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      
      <div style="text-align: center; margin: 2mm 0; font-size: 8px;">═══════════════════════════════</div>
      <div style="text-align: center; font-size: 8px; margin-top: 2mm;">Merci pour votre confiance</div>
    </div>
  `;
  
  // Create a temporary div with the print content
  const printDiv = document.createElement('div');
  printDiv.innerHTML = printContent;
  printDiv.style.position = 'fixed';
  printDiv.style.top = '0';
  printDiv.style.left = '0';
  printDiv.style.width = '100%';
  printDiv.style.height = '100%';
  printDiv.style.backgroundColor = 'white';
  printDiv.style.zIndex = '9999';
  printDiv.style.overflow = 'auto';
  
  document.body.appendChild(printDiv);
  
  // Generate QR code using local library
  const qrElement = printDiv.querySelector('#qrcode-fallback') as HTMLElement;
  if (qrElement) {
    console.log('Generating QR code in fallback...');
    // Create a canvas element
    const canvas = document.createElement('canvas');
    qrElement.appendChild(canvas);
    
    QRCode.toCanvas(canvas, qrUrl, {
      width: 100,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }).then(() => {
      console.log('QR code généré avec succès dans fallback');
      // Print after QR code is generated
      setTimeout(() => {
        window.print();
        // Remove the print div after a delay
        setTimeout(() => {
          document.body.removeChild(printDiv);
        }, 1000);
      }, 500);
    }).catch((error) => {
      console.error('Erreur génération QR code fallback:', error);
      qrElement.innerHTML = '<div style="font-size: 8px; color: #666;">QR: ' + qrUrl + '</div>';
      // Print anyway
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.removeChild(printDiv);
        }, 1000);
      }, 500);
    });
  } else {
    console.log('QR element not found in fallback');
    // Print without QR code
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.removeChild(printDiv);
      }, 1000);
    }, 500);
  }
};

export const ReceptionPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const { settings } = useAppSettings();
  const queryClient = useQueryClient();

  // Debug: Log tenant ID
  React.useEffect(() => {
    console.log('ReceptionPage - Tenant ID:', tenantId);
  }, [tenantId]);
  const [isAdding, setIsAdding] = React.useState(false);
  const [isAddingTruck, setIsAddingTruck] = React.useState(false);
  const [isAddingDriver, setIsAddingDriver] = React.useState(false);
  const [isAddingProduct, setIsAddingProduct] = React.useState(false);
  const [editingTruckId, setEditingTruckId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    clientId: '',
    truckId: '',
    driverId: '',
    productId: '',
    roomId: '',
    totalCrates: 0,
    crateType: '',
    notes: '',
    arrivalTime: new Date(),
  });
  const [truckForm, setTruckForm] = React.useState({
    number: '',
    color: '',
    photoUrl: '',
  });
  const [isUploadingTruckPhoto, setIsUploadingTruckPhoto] = React.useState(false);
  const [driverForm, setDriverForm] = React.useState({
    name: '',
    phone: '',
    licenseNumber: '',
  });
  const [productForm, setProductForm] = React.useState({
    name: 'Pommier',
    variety: '',
    imageUrl: '',
  });
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const [editingReceptionId, setEditingReceptionId] = React.useState<string | null>(null);
  const [deletingReceptionId, setDeletingReceptionId] = React.useState<string | null>(null);
  
  // Filter states
  const [clientFilter, setClientFilter] = React.useState<string>('');
  const [nameFilter, setNameFilter] = React.useState<string>('');
  const [sortBy, setSortBy] = React.useState<'date' | 'client' | 'crates' | 'truck' | 'cumulative'>('date');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  
  // Pallet modal states
  const [showPalletModal, setShowPalletModal] = React.useState(false);
  const [selectedReception, setSelectedReception] = React.useState<any>(null);
  const [cratesPerPallet, setCratesPerPallet] = React.useState(42);
  const [customPalletCrates, setCustomPalletCrates] = React.useState<{[key: number]: number}>({});
  const [palletCollectionId, setPalletCollectionId] = React.useState<string | null>(null);
  const [isPalletDataSaved, setIsPalletDataSaved] = React.useState(false);

  // Fetch crate types from database
  const { data: crateTypes = [] } = useQuery({
    queryKey: ['crate-types', tenantId],
    queryFn: async () => {
      const q = query(collection(db, 'tenants', tenantId, 'crate-types'), where('isActive', '==', true));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },
  });

  // Fetch reservations to filter rooms by client
  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', tenantId],
    queryFn: async () => {
      const q = query(collection(db, 'tenants', tenantId, 'reservations'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },
  });

  // Fetch existing pallet collection data
  const { data: existingPalletData } = useQuery({
    queryKey: ['pallet-collection', selectedReception?.id],
    queryFn: async () => {
      if (!selectedReception?.id) return null;
      
      const q = query(
        collection(db, 'pallet-collections'), 
        where('receptionId', '==', selectedReception.id),
        where('tenantId', '==', tenantId)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return null;
      
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    },
    enabled: !!selectedReception?.id
  });


  // Generate unique pallet reference
  const generatePalletReference = (palletNumber: number) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const clientCode = selectedReception?.clientName?.substring(0, 3).toUpperCase() || 'CLI';
    return `PAL-${year}${month}${day}-${clientCode}-${String(palletNumber).padStart(3, '0')}`;
  };

  // Pallet calculation logic with custom crate support
  const palletCalculation = React.useMemo(() => {
    if (!selectedReception) return { fullPallets: 0, remainingCrates: 0, totalPallets: 0, pallets: [] };
    
    const totalCrates = selectedReception.totalCrates;
    const fullPallets = Math.floor(totalCrates / cratesPerPallet);
    const remainingCrates = totalCrates % cratesPerPallet;
    const totalPallets = fullPallets + (remainingCrates > 0 ? 1 : 0);
    
    // Generate pallet details with unique references and custom crate support
    const pallets = [];
    let remainingCratesToDistribute = totalCrates;
    
    for (let i = 1; i <= totalPallets; i++) {
      const customCrates = customPalletCrates[i];
      let palletCrates;
      
      if (customCrates !== undefined) {
        // Use custom crate count if set
        palletCrates = Math.min(customCrates, remainingCratesToDistribute);
      } else if (i <= fullPallets) {
        // Full pallet
        palletCrates = cratesPerPallet;
      } else {
        // Last pallet with remaining crates
        palletCrates = remainingCratesToDistribute;
      }
      
      pallets.push({
        number: i,
        crates: palletCrates,
        isFull: customCrates !== undefined ? palletCrates === customCrates : (i <= fullPallets),
        isCustom: customCrates !== undefined,
        reference: generatePalletReference(i)
      });
      
      remainingCratesToDistribute -= palletCrates;
    }
    
    return { 
      fullPallets, 
      remainingCrates, 
      totalPallets, 
      pallets,
      totalCratesUsed: totalCrates - remainingCratesToDistribute
    };
  }, [selectedReception, cratesPerPallet, customPalletCrates]);

  // Handle pallet modal
  const handlePalletCollection = (reception: any) => {
    setSelectedReception(reception);
    setCustomPalletCrates({}); // Reset custom crate counts
    setPalletCollectionId(null);
    setIsPalletDataSaved(false);
    setShowPalletModal(true);
  };

  // Load existing pallet data when it's available
  React.useEffect(() => {
    if (existingPalletData) {
      setPalletCollectionId(existingPalletData.id);
      setCratesPerPallet((existingPalletData as any).cratesPerPallet || 42);
      setCustomPalletCrates((existingPalletData as any).customPalletCrates || {});
      setIsPalletDataSaved(true);
    }
  }, [existingPalletData]);

  // Reset room selection when client changes
  React.useEffect(() => {
    setForm(prev => ({ ...prev, roomId: '' }));
  }, [form.clientId]);

  // Handle custom crate count change
  const handleCustomCrateChange = (palletNumber: number, crateCount: number) => {
    setCustomPalletCrates(prev => ({
      ...prev,
      [palletNumber]: crateCount
    }));
    setIsPalletDataSaved(false); // Mark as unsaved when changes are made
  };

  // Reset custom crate counts
  const resetCustomCrates = () => {
    setCustomPalletCrates({});
    setIsPalletDataSaved(false); // Mark as unsaved when reset
  };

  // Save pallet collection data
  const savePalletCollection = useMutation({
    mutationFn: async () => {
      if (!selectedReception) return;

      const palletData = {
        tenantId,
        receptionId: selectedReception.id,
        clientId: selectedReception.clientId,
        clientName: selectedReception.clientName,
        totalCrates: selectedReception.totalCrates,
        cratesPerPallet,
        customPalletCrates,
        pallets: palletCalculation.pallets,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (palletCollectionId) {
        // Update existing pallet collection
        const palletRef = doc(db, 'pallet-collections', palletCollectionId);
        await updateDoc(palletRef, {
          ...palletData,
          updatedAt: Timestamp.fromDate(new Date()),
        });
      } else {
        // Create new pallet collection
        const docRef = await addDoc(collection(db, 'pallet-collections'), palletData);
        setPalletCollectionId(docRef.id);
      }

      await logCreate('pallet-collection', undefined, `Pallet collection saved for ${selectedReception.clientName}`, 'admin', 'Administrateur');
    },
    onSuccess: () => {
      setIsPalletDataSaved(true);
      queryClient.invalidateQueries({ queryKey: ['pallet-collection', selectedReception?.id] });
    },
  });

  // Generate pallet collection tickets with 8-section format
  const generatePalletTickets = async () => {
    if (!selectedReception) return;

    const { pallets } = palletCalculation;
    const tickets: Array<{
      palletNumber: number;
      crateCount: number;
      isFull: boolean;
      reference: string;
      reception: any;
    }> = [];
    
    // Generate tickets for all pallets
    pallets.forEach(pallet => {
      tickets.push({
        palletNumber: pallet.number,
        crateCount: pallet.crates,
        isFull: pallet.isFull,
        reference: pallet.reference,
        reception: selectedReception
      });
    });

    // Save pallet collection data to Firebase before printing
    try {
      await savePalletCollection.mutateAsync();
    } catch (error) {
      console.error('Error saving pallet collection data:', error);
      // Continue with printing even if save fails
    }

    // Generate A4/8 tickets (8 tickets per A4 page) with 8-section format
    const ticketsPerPage = 8;
    const pages = Math.ceil(tickets.length / ticketsPerPage);
    
    let printContent = '';
    
    for (let page = 0; page < pages; page++) {
      const pageTickets = tickets.slice(page * ticketsPerPage, (page + 1) * ticketsPerPage);
      
      printContent += `
        <div style="page-break-after: ${page < pages - 1 ? 'always' : 'avoid'}; width: 210mm; height: 297mm; padding: 10mm; font-family: Arial, sans-serif;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr 1fr 1fr; gap: 9mm; height: 100%;">
      `;
      
      pageTickets.forEach((ticket) => {
        const qrData = JSON.stringify({
          date: ticket.reception.arrivalTime.toISOString(),
          client: ticket.reception.clientName,
          culture: ticket.reception.productName,
          variety: ticket.reception.productVariety,
          palletNumber: ticket.palletNumber,
          palletReference: ticket.reference,
          crateCount: ticket.crateCount,
          room: ticket.reception.roomName,
          isFull: ticket.isFull
        });
        
        // Generate QR Code using the qrcode library
        const generateQRCode = async (data: string) => {
          try {
            const qrDataURL = await QRCode.toDataURL(data, {
              width: 200,
              margin: 1,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            return `<img src="${qrDataURL}" style="width: 100%; height: 100%; object-fit: contain;" />`;
          } catch (error) {
            console.error('QR Code generation failed:', error);
            // Fallback to simple pattern
            return generateQRPattern(data);
          }
        };

        // Generate working barcode-style pattern
        const generateBarcodePattern = (data: string) => {
          let pattern = '';
          let hash = 0;
          
          // Create hash from data
          for (let i = 0; i < data.length; i++) {
            hash = ((hash << 5) - hash + data.charCodeAt(i)) & 0xffffffff;
          }
          
          // Generate barcode-like pattern (vertical bars)
          for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 20; j++) {
              const index = (i * 20 + j) % 32;
              const isBlack = (hash >> index) & 1;
              pattern += isBlack ? '█' : '░';
            }
            pattern += '<br/>';
          }
          return pattern;
        };

        // Generate QR-like pattern for pallet reference
        const generateQRPattern = (data: string) => {
          const size = 9;
          let pattern = '';
          let hash = 0;
          
          // Create hash from data
          for (let i = 0; i < data.length; i++) {
            hash = ((hash << 5) - hash + data.charCodeAt(i)) & 0xffffffff;
          }
          
          for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
              let isBlack = false;
              
              // Corner markers (QR code style)
              if ((i < 3 && j < 3) || (i < 3 && j >= size - 3) || (i >= size - 3 && j < 3)) {
                if (i === 0 || i === 2 || j === 0 || j === 2) {
                  isBlack = true;
                }
                if (i === 1 && j === 1) {
                  isBlack = true;
                }
              } else {
                // Data area - use hash to determine pattern
                const index = (i * size + j) % 32;
                isBlack = (hash >> index) & 1;
              }
              
              pattern += isBlack ? '█' : '░';
            }
            pattern += '<br/>';
          }
          return pattern;
        };


        printContent += `
          <div style="border: 1px solid #333333; border-radius: 3px; padding: 0.6mm; background: #ffffff; font-family: 'Arial', sans-serif; height: 100%; display: flex; flex-direction: column; justify-content: center;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 0.4mm; border-bottom: 1px solid #cccccc; padding-bottom: 0.3mm;">
              <div style="color: #000000; font-size: 11pt; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 0.4mm;">DOMAINE LYAZAMI</div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9pt; color: #333333;">
                <div style="font-weight: 700; background: #f0f0f0; color: #000000; padding: 1px 3px; border-radius: 2px;">#${ticket.palletNumber}</div>
                <div style="background: #e0e0e0; color: #000000; padding: 1px 3px; border-radius: 2px; font-size: 8pt; font-weight: 600;">${ticket.isFull ? 'Complète' : 'Partielle'}</div>
                <div style="font-family: monospace; font-size: 8pt; font-weight: 600; color: #666666;">${ticket.reference}</div>
              </div>
            </div>
            
            <!-- Main Content - Centered Layout -->
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.8mm;">
              <!-- Data Table - Centered -->
              <div style="display: flex; flex-direction: column; gap: 0.7mm; width: 100%; max-width: 60mm;">
                <!-- Row 1: DATE -->
                <div style="display: flex; align-items: center; background: #f8f9fa; padding: 0.5mm; border-radius: 2px; border: 1px solid #e9ecef;">
                  <div style="width: 12mm; font-weight: 600; font-size: 9pt; color: #495057; text-align: center;">DATE</div>
                  <div style="flex: 1; font-size: 10pt; font-weight: 700; color: #000000; text-align: center;">${ticket.reception.arrivalTime.getDate()}/${ticket.reception.arrivalTime.getMonth() + 1}/${ticket.reception.arrivalTime.getFullYear()}</div>
                </div>
                
                <!-- Row 2: CARRE -->
                <div style="display: flex; align-items: center; background: #f8f9fa; padding: 0.5mm; border-radius: 2px; border: 1px solid #e9ecef;">
                  <div style="width: 12mm; font-weight: 600; font-size: 9pt; color: #495057; text-align: center;">CARRE</div>
                  <div style="flex: 1; font-size: 10pt; font-weight: 700; color: #000000; text-align: center;">${ticket.reception.clientName}</div>
                </div>
                
                <!-- Row 3: VARIETE -->
                <div style="display: flex; align-items: center; background: #fff3cd; padding: 0.5mm; border-radius: 2px; border: 1px solid #ffeaa7;">
                  <div style="width: 12mm; font-weight: 600; font-size: 9pt; color: #495057; text-align: center;">VARIETE</div>
                  <div style="flex: 1; font-size: 10pt; font-weight: 700; color: #000000; text-align: center;">${ticket.reception.productVariety || 'GOLD'}</div>
                </div>
                
                <!-- Row 4: PALETTE -->
                <div style="display: flex; align-items: center; background: #f8f9fa; padding: 0.5mm; border-radius: 2px; border: 1px solid #e9ecef;">
                  <div style="width: 12mm; font-weight: 600; font-size: 9pt; color: #495057; text-align: center;">PALETTE</div>
                  <div style="flex: 1; font-size: 10pt; font-weight: 700; color: #000000; text-align: center;">${ticket.palletNumber}</div>
                </div>
                
                <!-- Row 5: CAISSES -->
                <div style="display: flex; align-items: center; background: #fff3cd; padding: 0.5mm; border-radius: 2px; border: 1px solid #ffeaa7;">
                  <div style="width: 12mm; font-weight: 600; font-size: 9pt; color: #495057; text-align: center;">CAISSES</div>
                  <div style="flex: 1; font-size: 10pt; font-weight: 700; color: #000000; text-align: center;">${ticket.crateCount}</div>
                </div>
                
                <!-- Row 6: CHAMBRE -->
                <div style="display: flex; align-items: center; background: #f8f9fa; padding: 0.5mm; border-radius: 2px; border: 1px solid #e9ecef;">
                  <div style="width: 12mm; font-weight: 600; font-size: 9pt; color: #495057; text-align: center;">CHAMBRE</div>
                  <div style="flex: 1; font-size: 10pt; font-weight: 700; color: #000000; text-align: center;">${ticket.reception.roomName || '3'}</div>
                </div>
              </div>
              
              <!-- Barcode - Centered -->
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #000000; border-radius: 3px; padding: 0.5mm; background: #ffffff; width: 100%; max-width: 50mm;">
                <div class="barcode-container" data-reference="${ticket.reference}" style="width: 100%; height: 8mm; border: 1px solid #000000; border-radius: 2px; display: flex; align-items: center; justify-content: center; background: #ffffff; margin-bottom: 0.3mm; padding: 0.2mm;">
                  <div style="color: #000000; font-size: 10px; text-align: center; font-family: monospace; font-weight: bold; letter-spacing: 3px;">${ticket.reference}</div>
                </div>
                <div style="font-size: 6pt; color: #000000; text-align: center; font-weight: 700; font-family: monospace;">REF: ${ticket.reference}</div>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 0.3mm; padding-top: 0.2mm; border-top: 1px solid #000000; font-size: 7pt; color: #000000; font-weight: 600;">
              <p style="margin: 0;">Domaine Lyazami • ${new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
        `;
      });
      
      // Fill remaining slots with empty divs
      for (let i = pageTickets.length; i < ticketsPerPage; i++) {
        printContent += `<div></div>`;
      }
      
      printContent += `
          </div>
        </div>
      `;
    }

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Tickets Collecte Palette</title>
          <script src="https://cdn.jsdelivr.net/npm/bwip-js@4.0.0/dist/bwip-js.min.js"></script>
          <style>
            @media print {
              @page {
                size: A4;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
            .barcode-container {
              display: flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              height: 8mm;
              background: white;
              border: 1px solid #333;
              border-radius: 2px;
            }
            .barcode-container canvas {
              max-width: 100%;
              max-height: 100%;
              width: auto;
              height: auto;
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            // Generate barcodes using bwip-js library
            function generateBarcodes() {
              const barcodeContainers = document.querySelectorAll('.barcode-container');
              barcodeContainers.forEach((container, index) => {
                const reference = container.getAttribute('data-reference');
                if (reference) {
                  // Show reference as fallback
                  container.innerHTML = '<div style="color: #000000; font-size: 10px; text-align: center; font-family: monospace; font-weight: bold; letter-spacing: 3px;">' + reference + '</div>';
                  
                  // Try to generate barcode if library is available
                  if (typeof bwipjs !== 'undefined') {
                    try {
                      // Clear container
                      container.innerHTML = '';
                      
                      // Create canvas for barcode
                      const canvas = document.createElement('canvas');
                      container.appendChild(canvas);
                      
                      // Generate barcode
                      bwipjs.toCanvas(canvas, {
                        bcid: 'code128',        // Barcode type
                        text: reference,        // Text to encode
                        scale: 1,              // Smaller scale factor
                        height: 15,            // Smaller bar height
                        includetext: false,    // Don't show text below barcode
                        textxalign: 'center',  // Center text
                      });
                    } catch (e) {
                      console.error('Barcode generation failed:', e);
                      // Fallback to text
                      container.innerHTML = '<div style="color: #000000; font-size: 10px; text-align: center; font-family: monospace; font-weight: bold; letter-spacing: 3px;">' + reference + '</div>';
                    }
                  }
                }
              });
            }
            
            // Generate barcodes when page loads
            window.addEventListener('load', generateBarcodes);
            setTimeout(generateBarcodes, 500);
            setTimeout(generateBarcodes, 1000);
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Upload image to Firebase Storage
  const uploadImage = async (file: File): Promise<string> => {
    const imageRef = ref(storage, `products/${tenantId}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(imageRef, file);
    return await getDownloadURL(snapshot.ref);
  };

  // Handle image file upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La taille du fichier ne doit pas dépasser 5MB');
      return;
    }

    setIsUploadingImage(true);
    try {
      const imageUrl = await uploadImage(file);
      setProductForm(prev => ({ ...prev, imageUrl }));
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Erreur lors de l\'upload de l\'image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Handle truck photo upload
  const handleTruckPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La taille du fichier ne doit pas dépasser 5MB');
      return;
    }

    setIsUploadingTruckPhoto(true);
    try {
      const photoUrl = await uploadImage(file);
      setTruckForm(prev => ({ ...prev, photoUrl }));
    } catch (error) {
      console.error('Error uploading truck photo:', error);
      alert('Erreur lors de l\'upload de la photo');
    } finally {
      setIsUploadingTruckPhoto(false);
    }
  };

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ['clients', tenantId],
    queryFn: async (): Promise<Client[]> => {
      if (!tenantId) {
        console.warn('No tenant ID available for clients query');
        return [];
      }
      
      try {
        console.log('Fetching clients for tenant:', tenantId);
        
        // Use tenant-specific subcollection (recommended for SaaS)
        const q = query(collection(db, 'tenants', tenantId, 'clients'));
        const snap = await getDocs(q);
        
        const clientsData = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name || '',
            phone: data.phone || '',
            company: data.company || '',
            reservedCrates: data.reservedCrates || 0,
            requiresEmptyCrates: data.requiresEmptyCrates || false,
          };
        });
        
        console.log('Clients loaded:', clientsData.length, 'clients');
        return clientsData;
      } catch (error) {
        console.error('Error fetching clients:', error);
        return [];
      }
    },
  });

  // Fetch trucks
  const { data: trucks } = useQuery({
    queryKey: ['trucks', tenantId],
    queryFn: async (): Promise<Truck[]> => {
      if (!tenantId) {
        console.warn('No tenant ID available for trucks query');
        return [];
      }
      
      try {
        console.log('Fetching trucks for tenant:', tenantId);
        const q = query(collection(db, 'trucks'), where('tenantId', '==', tenantId), where('isActive', '==', true));
        const snap = await getDocs(q);
        const trucksData = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            number: data.number || '',
            color: data.color || '',
            photoUrl: data.photoUrl || '',
            isActive: data.isActive !== false,
          };
        });
        console.log('Trucks loaded:', trucksData.length, 'trucks');
        return trucksData;
      } catch (error) {
        console.error('Error fetching trucks:', error);
        return [];
      }
    },
  });

  // Fetch drivers
  const { data: drivers } = useQuery({
    queryKey: ['drivers', tenantId],
    queryFn: async (): Promise<Driver[]> => {
      if (!tenantId) {
        console.warn('No tenant ID available for drivers query');
        return [];
      }
      
      try {
        console.log('Fetching drivers for tenant:', tenantId);
        const q = query(collection(db, 'drivers'), where('tenantId', '==', tenantId), where('isActive', '==', true));
        const snap = await getDocs(q);
        const driversData = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name || '',
            phone: data.phone || '',
            licenseNumber: data.licenseNumber || '',
            isActive: data.isActive !== false,
          };
        });
        console.log('Drivers loaded:', driversData.length, 'drivers');
        return driversData;
      } catch (error) {
        console.error('Error fetching drivers:', error);
        return [];
      }
    },
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products', tenantId],
    queryFn: async (): Promise<Product[]> => {
      if (!tenantId) {
        console.warn('No tenant ID available for products query');
        return [];
      }
      
      try {
        console.log('Fetching products for tenant:', tenantId);
        const q = query(collection(db, 'products'), where('tenantId', '==', tenantId), where('isActive', '==', true));
        const snap = await getDocs(q);
        const productsData = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name || '',
            variety: data.variety || '',
            imageUrl: data.imageUrl || '',
            isActive: data.isActive !== false,
          };
        });
        console.log('Products loaded:', productsData.length, 'products');
        return productsData;
      } catch (error) {
        console.error('Error fetching products:', error);
        return [];
      }
    },
  });

  // Fetch rooms
  const { data: rooms } = useQuery({
    queryKey: ['rooms', tenantId],
    queryFn: async (): Promise<Room[]> => {
      if (!tenantId) {
        console.warn('No tenant ID available for rooms query');
        return [];
      }
      
      try {
        console.log('Fetching rooms for tenant:', tenantId);
        const q = query(collection(db, 'rooms'), where('tenantId', '==', tenantId), where('active', '==', true));
        const snap = await getDocs(q);
        const roomsData = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            room: data.room || '',
            capacity: data.capacity || 0,
            capacityCrates: data.capacityCrates || 0,
            capacityPallets: data.capacityPallets || 0,
            sensorId: data.sensorId || '',
            active: data.active !== false,
          };
        });
        console.log('Rooms loaded:', roomsData.length, 'rooms');
        return roomsData;
      } catch (error) {
        console.error('Error fetching rooms:', error);
        return [];
      }
    },
  });

  // Filter rooms by client reservations
  const filteredRooms = React.useMemo(() => {
    // If no client selected or no data available, show all rooms
    if (!form.clientId || !rooms || rooms.length === 0) {
      return rooms || [];
    }
    
    // If no reservations available, show all rooms
    if (!reservations || reservations.length === 0) {
      return rooms;
    }
    
    // Get all reservations for this client (any status)
    const clientReservations = reservations.filter((reservation: any) => 
      reservation.clientId === form.clientId
    );
    
    // If no reservations for this client, show all rooms
    if (clientReservations.length === 0) {
      return rooms;
    }
    
    // Extract room IDs from all client reservations
    const reservedRoomIds = new Set();
    
    clientReservations.forEach((reservation: any) => {
      if (reservation.selectedRooms && Array.isArray(reservation.selectedRooms)) {
        reservation.selectedRooms.forEach((roomId: string) => {
          reservedRoomIds.add(roomId);
        });
      }
    });
    
    // If no rooms found in reservations, show all rooms
    if (reservedRoomIds.size === 0) {
      return rooms;
    }
    
    // Filter rooms to only show reserved ones
    return rooms.filter(room => reservedRoomIds.has(room.id));
  }, [form.clientId, reservations, rooms]);

  const { data: receptions, isLoading, error } = useQuery({
    queryKey: ['receptions', tenantId],
    queryFn: async (): Promise<Reception[]> => {
      const q = query(collection(db, 'receptions'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          serial: data.serial || '',
          clientId: data.clientId || '',
          clientName: data.clientName || '',
          truckId: data.truckId || '',
          truckNumber: data.truckNumber || '',
          driverId: data.driverId || '',
          driverName: data.driverName || '',
          driverPhone: data.driverPhone || '',
          productId: data.productId || '',
          productName: data.productName || '',
          productVariety: data.productVariety || '',
          roomId: data.roomId || '',
          roomName: data.roomName || '',
          totalCrates: data.totalCrates || 0,
          arrivalTime: data.arrivalTime?.toDate?.() || new Date(),
          status: data.status || 'pending',
          notes: data.notes || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
        };
      });
    },
  });

  const addTruck = useMutation({
    mutationFn: async (payload: typeof truckForm) => {
      const docRef = await addDoc(collection(db, 'trucks'), {
        tenantId,
        ...payload,
        isActive: true,
        createdAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    },
    onSuccess: async (truckId) => {
      await queryClient.invalidateQueries({ queryKey: ['trucks', tenantId] });
      setIsAddingTruck(false);
      setTruckForm({ number: '', color: '', photoUrl: '' });
      // Auto-select the newly created truck
      setForm(prev => ({ ...prev, truckId }));
      await logCreate('truck', undefined, `Camion créé: ${truckForm.number}`, 'admin', 'Administrateur');
    },
  });

  const addDriver = useMutation({
    mutationFn: async (payload: typeof driverForm) => {
      const docRef = await addDoc(collection(db, 'drivers'), {
        tenantId,
        ...payload,
        isActive: true,
        createdAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    },
    onSuccess: async (driverId) => {
      await queryClient.invalidateQueries({ queryKey: ['drivers', tenantId] });
      setIsAddingDriver(false);
      setDriverForm({ name: '', phone: '', licenseNumber: '' });
      // Auto-select the newly created driver
      setForm(prev => ({ ...prev, driverId }));
      await logCreate('driver', undefined, `Chauffeur créé: ${driverForm.name}`, 'admin', 'Administrateur');
    },
  });

  const addProduct = useMutation({
    mutationFn: async (payload: typeof productForm) => {
      const docRef = await addDoc(collection(db, 'products'), {
        tenantId,
        ...payload,
        isActive: true,
        createdAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    },
    onSuccess: async (productId) => {
      await queryClient.invalidateQueries({ queryKey: ['products', tenantId] });
      setIsAddingProduct(false);
      setProductForm({ name: 'Pommier', variety: '', imageUrl: '' });
      // Auto-select the newly created product
      setForm(prev => ({ ...prev, productId }));
      await logCreate('product', undefined, `Produit créé: ${productForm.name} - ${productForm.variety}`, 'admin', 'Administrateur');
    },
  });

  const addReception = useMutation({
    mutationFn: async (payload: typeof form) => {
      // Get selected client, truck, driver, product, and room details
      const selectedClient = clients?.find(c => c.id === payload.clientId);
      const selectedTruck = trucks?.find(t => t.id === payload.truckId);
      const selectedDriver = payload.driverId ? drivers?.find(d => d.id === payload.driverId) : null;
      const selectedProduct = products?.find(p => p.id === payload.productId);
      const selectedRoom = rooms?.find(r => r.id === payload.roomId);

      const receptionData = {
        tenantId,
        clientId: payload.clientId,
        clientName: selectedClient?.name || '',
        clientPhone: selectedClient?.phone || '',
        clientCompany: selectedClient?.company || '',
        truckId: payload.truckId,
        truckNumber: selectedTruck?.number || '',
        driverId: payload.driverId || '',
        driverName: selectedDriver?.name || '',
        driverPhone: selectedDriver?.phone || '',
        productId: payload.productId,
        productName: selectedProduct?.name || '',
        productVariety: selectedProduct?.variety || '',
        roomId: payload.roomId,
        roomName: selectedRoom?.room || '',
        totalCrates: payload.totalCrates,
        crateType: payload.crateType,
        notes: payload.notes,
        status: 'pending',
        arrivalTime: Timestamp.fromDate(payload.arrivalTime),
      };

      if (editingReceptionId) {
        // Update existing reception
        const receptionRef = doc(db, 'receptions', editingReceptionId);
        await updateDoc(receptionRef, receptionData);
        await logUpdate('reception', editingReceptionId, `Réception mise à jour: ${payload.truckId}`, 'admin', 'Administrateur');
      } else {
        // Create new reception
        await addDoc(collection(db, 'receptions'), {
          ...receptionData,
          serial: generateSerial(),
          createdAt: Timestamp.fromDate(new Date()),
        });
        await logCreate('reception', undefined, `Réception créée: ${payload.truckId}`, 'admin', 'Administrateur');
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['receptions', tenantId] });
      setIsAdding(false);
      setEditingReceptionId(null);
      setForm({
        clientId: '',
        truckId: '',
        driverId: '',
        productId: '',
        roomId: '',
        totalCrates: 0,
        crateType: '',
        notes: '',
        arrivalTime: new Date(),
      });
    },
  });


  const deleteReception = useMutation({
    mutationFn: async (receptionId: string) => {
      await deleteDoc(doc(db, 'receptions', receptionId));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['receptions', tenantId] });
      setDeletingReceptionId(null);
      await logDelete('reception', deletingReceptionId!, 'Réception supprimée', 'admin', 'Administrateur');
    },
  });

  // Fetch empty crate loans for selected client
  const { data: clientLoans } = useQuery({
    queryKey: ['empty-crate-loans', tenantId, form.clientId],
    queryFn: async (): Promise<EmptyCrateLoan[]> => {
      if (!form.clientId) return [];
      console.log('🔍 Fetching loans for clientId:', form.clientId);
      const q = query(
        collection(db, 'empty_crate_loans'), 
        where('tenantId', '==', tenantId),
        where('clientId', '==', form.clientId)
        // Removed status filter to get all loans
      );
      const snap = await getDocs(q);
      console.log('📦 Found loans:', snap.docs.length);
      const loans = snap.docs.map((d) => {
        const data = d.data() as any;
        console.log('📋 Loan data:', data);
        return {
          id: d.id,
          clientId: data.clientId || '',
          crates: Number(data.crates) || 0,
          status: data.status || 'open',
        };
      });
      console.log('✅ Processed loans:', loans);
      return loans;
    },
    enabled: !!form.clientId,
  });

  // Get selected client info
  const selectedClient = clients?.find(client => client.id === form.clientId);
  console.log('👤 Selected client:', selectedClient);
  console.log('📊 Client loans:', clientLoans);

  // Calculate total empty crates taken by client (only active loans)
  const totalEmptyCratesTaken = clientLoans?.filter(loan => loan.status === 'open').reduce((sum, loan) => sum + loan.crates, 0) || 0;
  console.log('🔢 Total empty crates taken:', totalEmptyCratesTaken);

  // Force refetch client loans when form.clientId changes
  React.useEffect(() => {
    if (form.clientId) {
      console.log('🔄 Refetching client loans for client:', form.clientId);
      queryClient.invalidateQueries({ 
        queryKey: ['clientLoans', form.clientId, tenantId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['clientReservations', form.clientId, tenantId] 
      });
    }
  }, [form.clientId, queryClient, tenantId]);

  // Filter and sort receptions with cumulative calculation
  const filteredAndSortedReceptions = React.useMemo(() => {
    if (!receptions) return [];
    
    let filtered = receptions;
    
    // Filter by client
    if (clientFilter) {
      filtered = filtered.filter(reception => reception.clientId === clientFilter);
    }
    
    // Filter by name search
    if (nameFilter.trim()) {
      filtered = filtered.filter(reception => 
        reception.clientName.toLowerCase().includes(nameFilter.toLowerCase()) ||
        reception.truckNumber.toLowerCase().includes(nameFilter.toLowerCase()) ||
        reception.driverName.toLowerCase().includes(nameFilter.toLowerCase()) ||
        reception.productName.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }
    
    // Group receptions by client and calculate cumulative
    const clientReceptions = new Map<string, (Reception & { cumulativeCrates: number })[]>();
    filtered.forEach(reception => {
      if (!clientReceptions.has(reception.clientName)) {
        clientReceptions.set(reception.clientName, []);
      }
      clientReceptions.get(reception.clientName)!.push({
        ...reception,
        cumulativeCrates: 0 // Will be calculated below
      });
    });

    // Calculate cumulative for each client
    const result: (Reception & { cumulativeCrates: number })[] = [];
    
    clientReceptions.forEach(clientReceptionList => {
      // Sort by arrival time
      const sortedReceptions = clientReceptionList.sort((a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime());
      
      let cumulative = 0;
      sortedReceptions.forEach(reception => {
        cumulative += reception.totalCrates;
        result.push({
          ...reception,
          cumulativeCrates: cumulative
        });
      });
    });
    
    // Sort results based on selected criteria
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = a.arrivalTime.getTime() - b.arrivalTime.getTime();
          break;
        case 'client':
          comparison = a.clientName.localeCompare(b.clientName);
          break;
        case 'crates':
          comparison = a.totalCrates - b.totalCrates;
          break;
        case 'truck':
          comparison = a.truckNumber.localeCompare(b.truckNumber);
          break;
        case 'cumulative':
          comparison = a.cumulativeCrates - b.cumulativeCrates;
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [receptions, clientFilter, nameFilter, sortBy, sortOrder]);

  // Handle edit reception
  const handleEditReception = (reception: Reception) => {
    console.log('🔧 Editing reception:', reception);
    setEditingReceptionId(reception.id);
    setForm({
      clientId: reception.clientId,
      truckId: reception.truckId,
      driverId: reception.driverId,
      productId: reception.productId,
      roomId: reception.roomId || '',
      totalCrates: reception.totalCrates,
      crateType: (reception as any).crateType || '',
      notes: reception.notes || '',
      arrivalTime: reception.arrivalTime,
    });
    setIsAdding(true);
  };

  // Handle delete reception
  const handleDeleteReception = (reception: Reception) => {
    const confirmMessage = t('reception.confirmDelete', `Êtes-vous sûr de vouloir supprimer la réception de ${reception.clientName} ?`) as string;
    if (window.confirm(confirmMessage)) {
      setDeletingReceptionId(reception.id);
      deleteReception.mutate(reception.id);
    }
  };

  // Handle QR code scanning - open specific reception
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const serial = urlParams.get('serial');
    
    if (serial && receptions) {
      const reception = receptions.find(r => r.serial === serial);
      if (reception) {
        // Scroll to the reception in the table
        const element = document.getElementById(`reception-${reception.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the row temporarily
          element.classList.add('bg-yellow-100', 'border-yellow-300');
          setTimeout(() => {
            element.classList.remove('bg-yellow-100', 'border-yellow-300');
          }, 3000);
        }
      }
    }
  }, [receptions]);

  // Handle print ticket for thermal POS-80 printer
  const handlePrintTicket = (reception: Reception) => {
    const currentDate = new Date();
    const ticketNumber = reception.serial || `REC-${reception.id.slice(-8).toUpperCase()}`;
    const baseUrl = settings.baseUrl || window.location.origin;
    const qrUrl = `${baseUrl}/reception/${reception.serial}`;
    
    // Try to open print window
    const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes,resizable=yes');
    
    if (!printWindow) {
      // Fallback: use current window
      console.log('Popup blocked, using current window for printing');
      printTicketInCurrentWindow(reception, ticketNumber, qrUrl, currentDate);
      return;
    }

    // Write the HTML content
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket de Réception - ${reception.clientName}</title>
        <meta charset="UTF-8">
        <script>
          // QR code will be generated by the parent window using local library
          function generateQRCode(text, element) {
            // This will be called from the parent window
            element.innerHTML = '<div style="font-size: 8px; color: #666;">Generating QR code...</div>';
          }
        </script>
        <style>
            @page { 
              size: 80mm auto; 
              margin: 0; 
            }
            body { 
              font-family: 'Courier New', monospace; 
              margin: 0; 
              padding: 0; 
              background: white;
              font-size: 10px;
              line-height: 1.2;
              width: 80mm;
              max-width: 80mm;
            }
            .ticket { 
              width: 80mm; 
              margin: 0; 
              padding: 2mm;
              box-sizing: border-box;
            }
            .header { 
              text-align: center; 
              border-bottom: 1px solid #000; 
              padding-bottom: 3mm; 
              margin-bottom: 3mm; 
            }
            .company-name { 
              font-size: 14px; 
              font-weight: bold; 
              margin-bottom: 1mm;
              letter-spacing: 1px;
            }
            .ticket-title { 
              font-size: 12px; 
              font-weight: bold; 
              margin-bottom: 1mm;
            }
            .ticket-number { 
              font-size: 10px; 
              color: #666; 
              margin-bottom: 2mm;
            }
            .section { 
              margin: 2mm 0; 
              border: 1px solid #000; 
              padding: 2mm;
            }
            .section-title { 
              font-weight: bold; 
              font-size: 10px; 
              margin-bottom: 1mm; 
              text-decoration: underline;
              text-transform: uppercase;
            }
            .row { 
              display: flex; 
              justify-content: space-between; 
              margin: 1mm 0; 
              padding: 0.5mm 0;
              font-size: 9px;
            }
            .label { 
              font-weight: bold; 
              flex: 1;
            }
            .value { 
              text-align: right; 
              flex: 1;
              font-weight: normal;
            }
            .highlight { 
              background-color: #000; 
              color: white; 
              padding: 1mm 2mm; 
              font-weight: bold;
              text-align: center;
              margin: 1mm 0;
            }
            .footer { 
              text-align: center; 
              margin-top: 3mm; 
              font-size: 8px; 
              color: #666;
              border-top: 1px solid #000;
              padding-top: 2mm;
            }
            .barcode-area {
              text-align: center;
              margin: 2mm 0;
              padding: 2mm;
              border: 1px dashed #000;
            }
            .signature-line {
              border-bottom: 1px solid #000;
              margin: 2mm 0;
              height: 8mm;
            }
            .divider {
              text-align: center;
              margin: 2mm 0;
              font-size: 8px;
            }
            .center {
              text-align: center;
            }
            @media print { 
              body { margin: 0; padding: 0; }
              .ticket { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">
              <div class="company-name">Domaine LYAZAMI</div>
              <div class="ticket-title">BON DE SORTIE</div>
              <div class="ticket-number">N° ${ticketNumber}</div>
            </div>

            <div class="divider">═══════════════════════════════</div>

            <div class="section">
              <div class="section-title">Informations</div>
              <div class="row">
                <span class="label">Date:</span>
                <span class="value">${reception.arrivalTime.toLocaleDateString('fr-FR', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: '2-digit'
                })}</span>
              </div>
              <div class="row">
                <span class="label">Heure:</span>
                <span class="value">${reception.arrivalTime.toLocaleTimeString('fr-FR', { 
                  hour: '2-digit', 
                  minute: '2-digit'
                })}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Client</div>
              <div class="row">
                <span class="label">Nom:</span>
                <span class="value">${reception.clientName}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Transport</div>
              <div class="row">
                <span class="label">Camion:</span>
                <span class="value">${reception.truckNumber}</span>
              </div>
              <div class="row">
                <span class="label">Chauffeur:</span>
                <span class="value">${reception.driverName}</span>
              </div>
              ${reception.driverPhone ? `
              <div class="row">
                <span class="label">Tel:</span>
                <span class="value">${reception.driverPhone}</span>
              </div>
              ` : ''}
            </div>

            <div class="section">
              <div class="section-title">Produit</div>
              <div class="row">
                <span class="label">Type:</span>
                <span class="value">${reception.productName}</span>
              </div>
              ${reception.productVariety ? `
              <div class="row">
                <span class="label">Variété:</span>
                <span class="value">${reception.productVariety}</span>
              </div>
              ` : ''}
            </div>

            ${reception.roomName ? `
            <div class="section">
              <div class="section-title">Chambre</div>
              <div class="row">
                <span class="label">Chambre:</span>
                <span class="value">${reception.roomName}</span>
              </div>
            </div>
            ` : ''}

            <div class="highlight">
              <div class="center">CAISSES: ${reception.totalCrates}</div>
            </div>

            ${reception.notes ? `
            <div class="section">
              <div class="section-title">Notes</div>
              <div class="row">
                <span class="value">${reception.notes}</span>
              </div>
            </div>
            ` : ''}

            <div class="barcode-area">
              <div class="center" style="font-size: 8px; margin-bottom: 1mm;">Code de suivi</div>
              <div class="center" style="font-family: monospace; font-size: 10px; font-weight: bold;">${ticketNumber}</div>
              <div class="center" style="margin-top: 2mm;">
                <div id="qrcode" style="display: inline-block;"></div>
              </div>
            </div>

            <div class="divider">═══════════════════════════════</div>

            <div class="signature-line">
              <div style="display: flex; justify-content: space-between; margin-top: 1mm; font-size: 8px;">
                <span>Chauffeur:</span>
                <span>Responsable:</span>
              </div>
            </div>

            <div class="footer">
              <div>Domaine LYAZAMI</div>
              <div>${currentDate.toLocaleDateString('fr-FR')} ${currentDate.toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit'
              })}</div>
            </div>

            <div class="divider">═══════════════════════════════</div>
            <div class="center" style="font-size: 8px; margin-top: 2mm;">
              Merci pour votre confiance
            </div>
          </div>
          
        </body>
      </html>
    `);
    
    // Close the document and trigger print
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = function() {
      console.log('Print window loaded, generating QR code...');
      
      // Generate QR code using local library
      setTimeout(() => {
        const qrElement = printWindow.document.getElementById('qrcode');
        
        if (qrElement) {
          console.log('Generating QR code in print window...');
          // Create a canvas element
          const canvas = printWindow.document.createElement('canvas');
          qrElement.appendChild(canvas);
          
          QRCode.toCanvas(canvas, qrUrl, {
            width: 100,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          }).then(() => {
            console.log('QR code généré avec succès dans print window');
          }).catch((error) => {
            console.error('Erreur génération QR code:', error);
            qrElement.innerHTML = '<div style="font-size: 8px; color: #666;">QR: ' + qrUrl + '</div>';
          });
        } else {
          console.error('QR element not found in print window');
        }
        
        // Print after QR code is generated (or failed)
        setTimeout(() => {
          try {
            printWindow.print();
            console.log('Print dialog opened successfully');
          } catch (error) {
            console.error('Error printing:', error);
            alert('Erreur lors de l\'impression. Essayez de cliquer sur le bouton d\'impression dans la fenêtre qui s\'est ouverte.');
          }
        }, 1000);
      }, 500);
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading', 'Chargement...')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{t('common.error', 'Erreur de chargement')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reception.title', 'Réception pleines ')}</h1>
            <p className="text-gray-600">{t('reception.subtitle', 'Gérer les entrées de caisses produits clients')}</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          {t('reception.addReception', 'Nouvelle réception')}
        </button>
      </div>

      {/* Client Info Display */}
      {selectedClient && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('reception.clientInfo', 'Informations du client')}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{selectedClient.name}</span>
              {selectedClient.company && (
                <span className="text-sm text-gray-500">({selectedClient.company})</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-blue-50">
              <div className="text-sm text-gray-600">{t('reception.reservedCrates', 'Caisses réservées')}</div>
              <div className="mt-1 text-2xl font-bold text-blue-600">
                {selectedClient.reservedCrates || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t('reception.fromReservationsTable', 'Depuis la table réservations')}
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-green-50">
              <div className="text-sm text-gray-600">{t('reception.emptyCratesTaken', 'Caisses vides prises')}</div>
              <div className="mt-1 text-2xl font-bold text-green-600">
                {totalEmptyCratesTaken}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t('reception.fromLoansTable', 'Depuis la table prêts caisses vides')}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Filter Section - Hidden when adding/editing */}
      {!isAdding && (
        <Card className="bg-white border-0 shadow-sm rounded-xl">
          <div className="p-4 sm:p-6">
            <div className="space-y-4">
              {/* Mobile-First Filter Controls */}
              <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
                {/* Client Select Filter - Full width on mobile */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {t('reception.filterByClient', 'Client')}
                  </label>
                  <div className="relative">
                    <select
                      value={clientFilter}
                      onChange={(e) => setClientFilter(e.target.value)}
                      className="block w-full pl-4 pr-10 py-3 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none touch-manipulation"
                    >
                      <option value="">{t('reception.allClients', 'Tous les clients')}</option>
                      {(clients || []).map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3 pointer-events-none">
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Name Search Filter - Full width on mobile */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {t('reception.searchByName', 'Rechercher')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      placeholder={t('reception.searchPlaceholder', 'Rechercher...') as string}
                      className="block w-full pl-10 pr-10 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
                    />
                    {nameFilter && (
                      <button
                        onClick={() => setNameFilter('')}
                        className="absolute inset-y-0 right-0 pr-2 sm:pr-3 flex items-center hover:text-gray-600"
                      >
                        <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sort By - Full width on mobile */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {t('reception.sortBy', 'Trier par')}
                  </label>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="block w-full pl-4 pr-10 py-3 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none touch-manipulation"
                    >
                      <option value="date">{t('reception.sortByDate', 'Date')}</option>
                      <option value="client">{t('reception.sortByClient', 'Client')}</option>
                      <option value="crates">{t('reception.sortByCrates', 'Caisses')}</option>
                      <option value="truck">{t('reception.sortByTruck', 'Camion')}</option>
                      <option value="cumulative">{t('reception.sortByCumulative', 'Cumulatif')}</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3 pointer-events-none">
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Sort Order - Touch-friendly buttons */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {t('reception.sortOrder', 'Ordre')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSortOrder('asc')}
                      className={`px-4 py-3 text-sm font-medium rounded-lg transition-colors touch-manipulation ${
                        sortOrder === 'asc'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                      }`}
                      title="Ascendant"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        <span>↑</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setSortOrder('desc')}
                      className={`px-4 py-3 text-sm font-medium rounded-lg transition-colors touch-manipulation ${
                        sortOrder === 'desc'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                      }`}
                      title="Descendant"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span>↓</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile-Optimized Results Summary */}
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="text-xs sm:text-sm text-gray-600">
                    <span className="font-medium">{filteredAndSortedReceptions.length}</span> {filteredAndSortedReceptions.length === 1 ? 'réception' : 'réceptions'}
                    {(nameFilter || clientFilter) && (
                      <span className="ml-1 text-blue-600">
                        (filtré)
                      </span>
                    )}
                  </div>
                  {(nameFilter || clientFilter) && (
                    <button
                      onClick={() => {
                        setNameFilter('');
                        setClientFilter('');
                      }}
                      className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Add Reception Form */}
      {isAdding && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">{t('reception.addReception', 'Nouvelle réception')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.client', 'Client')}</label>
              <EnhancedSelect
                value={form.clientId}
                onChange={(value) => setForm((f) => ({ ...f, clientId: value }))}
                placeholder={t('reception.selectClient', 'Sélectionner un client')}
                options={clients?.map(client => ({
                  id: client.id,
                  value: client.id,
                  label: `${client.name} ${client.company ? `(${client.company})` : ''}`,
                  icon: '👤'
                })) || []}
                addLabel={t('reception.addClient', 'Ajouter un client')}
                editLabel={t('reception.editClient', 'Éditer')}
                onAdd={() => {/* TODO: Add client modal */}}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.truck', 'Camion')}</label>
              <EnhancedSelect
                value={form.truckId}
                onChange={(value) => setForm((f) => ({ ...f, truckId: value }))}
                placeholder={t('reception.selectTruck', 'Sélectionner un camion')}
                options={trucks?.map(truck => ({
                  id: truck.id,
                  value: truck.id,
                  label: `${truck.number} ${truck.color ? `(${truck.color})` : ''}`,
                  icon: '🚛'
                })) || []}
                editOptions={trucks?.map(truck => ({
                  id: truck.id,
                  value: truck.id,
                  label: truck.number,
                  icon: '🚛'
                })) || []}
                addLabel={t('reception.addTruck', 'Ajouter un camion')}
                editLabel={t('reception.editTruck', 'Éditer')}
                onAdd={() => setIsAddingTruck(true)}
                onEdit={(truckId) => {
                  const truck = trucks?.find(t => t.id === truckId);
                  if (truck) {
                    setTruckForm({
                      number: truck.number,
                      color: truck.color || '',
                      photoUrl: truck.photoUrl || ''
                    });
                    setEditingTruckId(truckId);
                    setIsAddingTruck(true);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('reception.driver', 'Chauffeur')}
              </label>
              <EnhancedSelect
                value={form.driverId}
                onChange={(value) => setForm((f) => ({ ...f, driverId: value }))}
                placeholder={t('reception.selectDriver', 'Sélectionner un chauffeur')}
                options={drivers?.map(driver => ({
                  id: driver.id,
                  value: driver.id,
                  label: `${driver.name} (${driver.licenseNumber})`,
                  icon: '👨‍💼'
                })) || []}
                editOptions={drivers?.map(driver => ({
                  id: driver.id,
                  value: driver.id,
                  label: driver.name,
                  icon: '👨‍💼'
                })) || []}
                addLabel={t('reception.addDriver', 'Ajouter un chauffeur')}
                editLabel={t('reception.editDriver', 'Éditer')}
                onAdd={() => setIsAddingDriver(true)}
                onEdit={(driverId) => {
                  const driver = drivers?.find(d => d.id === driverId);
                  if (driver) {
                    setDriverForm({
                      name: driver.name,
                      phone: driver.phone || '',
                      licenseNumber: driver.licenseNumber || ''
                    });
                    setIsAddingDriver(true);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.product', 'Produit')}</label>
              <EnhancedSelect
                value={form.productId}
                onChange={(value) => setForm((f) => ({ ...f, productId: value }))}
                placeholder={t('reception.selectProduct', 'Sélectionner un produit')}
                options={products?.map(product => ({
                  id: product.id,
                  value: product.id,
                  label: `${product.name} - ${product.variety}`,
                  icon: '📦'
                })) || []}
                editOptions={products?.map(product => ({
                  id: product.id,
                  value: product.id,
                  label: product.name,
                  icon: '📦'
                })) || []}
                addLabel={t('reception.addProduct', 'Ajouter un produit')}
                editLabel={t('reception.editProduct', 'Éditer')}
                onAdd={() => setIsAddingProduct(true)}
                onEdit={(productId) => {
                  const product = products?.find(p => p.id === productId);
                  if (product) {
                    setProductForm({
                      name: product.name,
                      variety: product.variety,
                      imageUrl: product.imageUrl || ''
                    });
                    setIsAddingProduct(true);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('reception.room', 'Chambre')}
                {form.clientId && filteredRooms.length < (rooms?.length || 0) && (
                  <span className="ml-2 text-xs text-blue-600">
                    ({filteredRooms.length} chambre{filteredRooms.length > 1 ? 's' : ''} réservée{filteredRooms.length > 1 ? 's' : ''})
                  </span>
                )}
              </label>
              <EnhancedSelect
                key={`room-select-${form.clientId}-${filteredRooms.length}`}
                value={form.roomId}
                onChange={(value) => setForm((f) => ({ ...f, roomId: value }))}
                placeholder={form.clientId ? t('reception.selectRoom', 'Sélectionner une chambre') : t('reception.selectClientFirst', 'Sélectionnez d\'abord un client')}
                options={filteredRooms?.map(room => ({
                  id: room.id,
                  value: room.id,
                  label: `${room.room} (${room.capacityCrates || room.capacity} caisses)`,
                  icon: '🏠'
                })) || []}
                addLabel={t('reception.addRoom', 'Ajouter une chambre')}
                editLabel={t('reception.editRoom', 'Éditer')}
                onAdd={() => {/* TODO: Add room modal - redirect to settings */}}
                onEdit={() => {/* TODO: Edit room - redirect to settings */}}
              />
              {form.clientId && filteredRooms.length === 0 && reservations.length === 0 && (
                <p className="mt-1 text-sm text-amber-600">
                  ⚠️ Aucune réservation trouvée dans le système - Toutes les chambres sont disponibles
                </p>
              )}
              {form.clientId && filteredRooms.length === 0 && reservations.length > 0 && (
                <p className="mt-1 text-sm text-amber-600">
                  ⚠️ Aucune chambre réservée pour ce client
                </p>
              )}
              {form.clientId && filteredRooms.length > 0 && filteredRooms.length < (rooms?.length || 0) && (
                <p className="mt-1 text-sm text-blue-600">
                  ℹ️ {filteredRooms.length} chambre{filteredRooms.length > 1 ? 's' : ''} réservée{filteredRooms.length > 1 ? 's' : ''} pour ce client
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.totalCrates', 'Nombre de caisses')}</label>
              <input
                type="number"
                min="0"
                value={form.totalCrates}
                onChange={(e) => setForm((f) => ({ ...f, totalCrates: Number(e.target.value) }))}
                className="w-full border rounded-md px-3 py-2"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('reception.crateType', 'Type de caisse')} <span className="text-red-500">*</span>
              </label>
              <select
                value={form.crateType}
                onChange={(e) => setForm((f) => ({ ...f, crateType: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
                required
              >
                <option value="">{t('reception.selectCrateType', 'Sélectionner un type de caisse')}</option>
                {crateTypes.map((type: any) => (
                  <option key={type.id} value={type.id}>
                    {type.customName || type.name} - {t(`loans.crateTypes.${type.type}`, type.type)} - {t(`loans.colors.${type.color}`, type.color)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('reception.arrivalDate', 'Date d\'arrivée')} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.arrivalTime.toISOString().split('T')[0]}
                onChange={(e) => {
                  const selectedDate = new Date(e.target.value);
                  const currentTime = form.arrivalTime;
                  const newDateTime = new Date(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth(),
                    selectedDate.getDate(),
                    currentTime.getHours(),
                    currentTime.getMinutes()
                  );
                  setForm((f) => ({ ...f, arrivalTime: newDateTime }));
                }}
                className="w-full border rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('reception.arrivalTime', 'Heure d\'arrivée')} <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={form.arrivalTime.toTimeString().slice(0, 5)}
                onChange={(e) => {
                  const [hours, minutes] = e.target.value.split(':').map(Number);
                  const currentDate = form.arrivalTime;
                  const newDateTime = new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth(),
                    currentDate.getDate(),
                    hours,
                    minutes
                  );
                  setForm((f) => ({ ...f, arrivalTime: newDateTime }));
                }}
                className="w-full border rounded-md px-3 py-2"
                required
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.notes', 'Notes')}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
                rows={3}
                placeholder={t('reception.notesPlaceholder', 'Notes additionnelles...') as string}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => addReception.mutate(form)}
              disabled={!form.clientId || !form.truckId || !form.productId || !form.crateType || addReception.isLoading}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-60"
            >
              {addReception.isLoading ? t('common.loading') : (editingReceptionId ? t('common.update') : t('common.save'))}
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setEditingReceptionId(null);
                setForm({
                  clientId: '',
                  truckId: '',
                  driverId: '',
                  productId: '',
                  roomId: '',
                  totalCrates: 0,
                  crateType: '',
                  notes: '',
                  arrivalTime: new Date(),
                });
              }}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
            >
              {t('common.cancel')}
            </button>
          </div>
        </Card>
      )}

      {/* Add Truck Modal */}
      {isAddingTruck && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {editingTruckId ? t('reception.editTruck', 'Éditer le camion') : t('reception.addTruck', 'Ajouter un camion')}
                </h3>
                <button
                  onClick={() => setIsAddingTruck(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('reception.truckNumber', 'Matricule du camion')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={truckForm.number}
                    onChange={(e) => setTruckForm((f) => ({ ...f, number: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('reception.truckNumberPlaceholder', 'Ex: TR-2025-001') as string}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.truckColor', 'Couleur')}</label>
                  <input
                    type="text"
                    value={truckForm.color}
                    onChange={(e) => setTruckForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('reception.truckColorPlaceholder', 'Ex: Rouge, Bleu, Blanc...') as string}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.uploadTruckPhoto', 'Photo du camion')}</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleTruckPhotoUpload}
                      className="hidden"
                      id="truck-photo-upload"
                      disabled={isUploadingTruckPhoto}
                    />
                    <label
                      htmlFor="truck-photo-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      {isUploadingTruckPhoto ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-gray-600">{t('reception.uploading', 'Upload en cours...')}</span>
                        </div>
                      ) : (
                        <div>
                          <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-sm text-gray-600 mt-1">
                            {t('reception.clickToUpload', 'Cliquez pour uploader')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {t('reception.maxSize', 'Max 5MB')}
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
                
                {truckForm.photoUrl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('reception.photoPreview', 'Aperçu de la photo')}</label>
                    <div className="flex justify-center">
                      <img
                        src={truckForm.photoUrl}
                        alt={truckForm.number}
                        className="w-32 h-32 object-cover rounded-md border"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => addTruck.mutate(truckForm)}
                  disabled={!truckForm.number || addTruck.isLoading || isUploadingTruckPhoto}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-60"
                >
                  {addTruck.isLoading ? t('common.loading') : t('common.save')}
                </button>
                <button
                  onClick={() => setIsAddingTruck(false)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Driver Modal */}
      {isAddingDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{t('reception.addDriver', 'Ajouter un chauffeur')}</h3>
                <button
                  onClick={() => setIsAddingDriver(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('reception.driverName', 'Nom du chauffeur')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={driverForm.name}
                    onChange={(e) => setDriverForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('reception.driverNamePlaceholder', 'Ex: Ahmed Benali') as string}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.driverPhone', 'Téléphone')}</label>
                  <input
                    type="tel"
                    value={driverForm.phone}
                    onChange={(e) => setDriverForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('reception.driverPhonePlaceholder', '0666507474') as string}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.licenseNumber', 'Numéro de permis')}</label>
                  <input
                    type="text"
                    value={driverForm.licenseNumber}
                    onChange={(e) => setDriverForm((f) => ({ ...f, licenseNumber: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('reception.licenseNumberPlaceholder', 'Ex: A123456789') as string}
                  />
                </div>
              </div>
              
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => addDriver.mutate(driverForm)}
                  disabled={!driverForm.name || addDriver.isLoading}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-60"
                >
                  {addDriver.isLoading ? t('common.loading') : t('common.save')}
                </button>
                <button
                  onClick={() => setIsAddingDriver(false)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{t('reception.addProduct', 'Ajouter un produit')}</h3>
                <button
                  onClick={() => setIsAddingProduct(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.productName', 'Nom du produit')}</label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('reception.productNamePlaceholder', 'Ex: Pommier') as string}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.variety', 'Variété')}</label>
                  <input
                    type="text"
                    value={productForm.variety}
                    onChange={(e) => setProductForm((f) => ({ ...f, variety: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2"
                    placeholder={t('reception.varietyPlaceholder', 'Ex: Golden Delicious') as string}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.uploadImage', 'Uploader une image')}</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                      disabled={isUploadingImage}
                    />
                    <label
                      htmlFor="image-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      {isUploadingImage ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm text-gray-600">{t('reception.uploading', 'Upload en cours...')}</span>
                        </div>
                      ) : (
                        <div>
                          <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-sm text-gray-600 mt-1">
                            {t('reception.clickToUpload', 'Cliquez pour uploader')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {t('reception.maxSize', 'Max 5MB')}
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
                
                {productForm.imageUrl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('reception.imagePreview', 'Aperçu de l\'image')}</label>
                    <div className="flex justify-center">
                      <img
                        src={productForm.imageUrl}
                        alt={productForm.name}
                        className="w-32 h-32 object-cover rounded-md border"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => addProduct.mutate(productForm)}
                  disabled={!productForm.name || !productForm.variety || addProduct.isLoading || isUploadingImage}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-60"
                >
                  {addProduct.isLoading ? t('common.loading') : t('common.save')}
                </button>
                <button
                  onClick={() => setIsAddingProduct(false)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Desktop Table View */}
      <Card className="hidden lg:block">
        <div className="overflow-x-auto">
          <Table className="min-w-full text-xs">
            <TableHead>
              <TableRow className="bg-gray-50">
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('reception.exitReceipt', 'Bon de sortie')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('reception.client', 'Client')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('reception.totalCrates', 'Caisses')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('reception.cumulative', 'Cumulatif')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('reception.arrivalTime', 'Date/Heure')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('reception.truckNumber', 'Camion')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('reception.driverName', 'Chauffeur')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('reception.product', 'Produit')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('reception.room', 'Chambre')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('reception.actions', 'Actions')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.isArray(filteredAndSortedReceptions) && filteredAndSortedReceptions.length > 0 ? (
                filteredAndSortedReceptions.map((r) => (
                  <TableRow key={r.id} id={`reception-${r.id}`} className="hover:bg-gray-50 border-b border-gray-200">
                    <TableCell className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handlePrintTicket(r)}
                          className="group relative inline-flex items-center justify-center w-10 h-10 text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                          title={t('reception.printExitReceipt', 'Imprimer bon de sortie') as string}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            {t('reception.printExitReceipt', 'Imprimer bon de sortie')}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </button>
                        <button
                          onClick={() => handlePalletCollection(r)}
                          className="group relative inline-flex items-center justify-center w-10 h-10 text-white bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                          title={t('reception.palletCollection', 'Collecte palette') as string}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            {t('reception.palletCollection', 'Collecte palette')}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 font-medium text-gray-900 truncate max-w-[120px]">
                      <span title={r.clientName}>{r.clientName}</span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {r.totalCrates}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <div className="text-xs sm:text-sm font-bold text-blue-600">
                        {r.cumulativeCrates}
                      </div>
                      <div className="text-xs text-gray-500">
                        total
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center text-gray-500 text-xs">
                      {r.arrivalTime.toLocaleDateString('fr-FR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-600 font-mono text-xs">
                      {r.truckNumber}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-600">
                      {r.driverName}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-600">
                      <div className="flex items-center gap-2">
                        {r.productName && (
                          <span className="font-medium">{r.productName}</span>
                        )}
                        {r.productVariety && (
                          <span className="text-xs text-gray-500">- {r.productVariety}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-600">
                      {r.roomName ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          🏠 {r.roomName}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Non assignée</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditReception(r)}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                          title={t('reception.edit', 'Modifier') as string}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteReception(r)}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                          title={t('reception.delete', 'Supprimer') as string}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500 text-sm">
                    {t('reception.noReceptions', 'Aucune réception')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {Array.isArray(filteredAndSortedReceptions) && filteredAndSortedReceptions.length > 0 ? (
          filteredAndSortedReceptions.map((r) => (
            <Card key={r.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="space-y-4">
                {/* Header with client name and print button */}
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{r.clientName}</h3>
                    <div className="mt-1 text-sm text-gray-500">
                      {r.arrivalTime.toLocaleDateString('fr-FR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePrintTicket(r)}
                      className="flex-shrink-0 inline-flex items-center justify-center w-12 h-12 text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                      title={t('reception.printExitReceipt', 'Imprimer bon de sortie') as string}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handlePalletCollection(r)}
                      className="flex-shrink-0 inline-flex items-center justify-center w-12 h-12 text-white bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                      title={t('reception.palletCollection', 'Collecte palette') as string}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Crate information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{r.totalCrates}</div>
                    <div className="text-sm text-blue-700">Caisses</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{r.cumulativeCrates}</div>
                    <div className="text-sm text-green-700">Cumulatif</div>
                  </div>
                </div>

                {/* Transport information */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Camion</span>
                    <span className="text-sm text-gray-900 font-mono">{r.truckNumber}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Chauffeur</span>
                    <span className="text-sm text-gray-900">{r.driverName}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Produit</span>
                    <div className="text-sm text-gray-900 text-right">
                      <div className="font-medium">{r.productName}</div>
                      {r.productVariety && (
                        <div className="text-xs text-gray-500">- {r.productVariety}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-gray-600">Chambre</span>
                    <div className="text-sm text-gray-900">
                      {r.roomName ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          🏠 {r.roomName}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Non assignée</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-2 pt-2 border-t border-gray-200">
                  <button
                    onClick={() => handleEditReception(r)}
                    className="flex-1 flex items-center justify-center space-x-2 text-blue-600 hover:text-blue-800 text-sm font-medium px-4 py-3 rounded-lg hover:bg-blue-50 transition-colors border border-blue-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Modifier</span>
                  </button>
                  <button
                    onClick={() => handleDeleteReception(r)}
                    className="flex-1 flex items-center justify-center space-x-2 text-red-600 hover:text-red-800 text-sm font-medium px-4 py-3 rounded-lg hover:bg-red-50 transition-colors border border-red-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Supprimer</span>
                  </button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-8 text-center text-gray-500">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune réception</h3>
            <p className="text-gray-600">Aucune réception trouvée avec les filtres actuels</p>
          </Card>
        )}
      </div>

      {/* Pallet Collection Modal */}
      {showPalletModal && selectedReception && (
        <>
          <style dangerouslySetInnerHTML={{
            __html: `
              @keyframes fadeInUp {
                from {
                  opacity: 0;
                  transform: translateY(20px) scale(0.9);
                }
                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
              @keyframes slideInFromTop {
                from {
                  opacity: 0;
                  transform: translateY(-20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              @keyframes scaleIn {
                from {
                  opacity: 0;
                  transform: scale(0.8);
                }
                to {
                  opacity: 1;
                  transform: scale(1);
                }
              }
              .modal-enter {
                animation: slideInFromTop 0.4s ease-out;
              }
              .card-enter {
                animation: scaleIn 0.3s ease-out;
              }
            `
          }} />
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 modal-enter">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {t('reception.palletCollection', 'Collecte palette')}
                    </h2>
                    {isPalletDataSaved && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ {t('reception.saved', 'Sauvegardé')}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mt-1">
                    {selectedReception.clientName} - {selectedReception.totalCrates} caisses
                  </p>
                </div>
                <button
                  onClick={() => setShowPalletModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Configuration */}
              <div className="mb-6 p-6 bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {t('reception.customizePalletSize', 'Personnaliser la taille des palettes')}
                  </h3>
                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('reception.cratesPerPallet', 'Caisses par palette')}
                      </label>
                      <input
                        type="number"
                        value={cratesPerPallet}
                        onChange={(e) => setCratesPerPallet(parseInt(e.target.value) || 42)}
                        min="1"
                        max="42"
                        className="w-24 px-4 py-3 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-center font-bold text-xl text-orange-700 bg-white shadow-md"
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600 mb-1">
                        {palletCalculation.totalPallets}
                      </div>
                      <div className="text-sm text-orange-700 font-medium">
                        {t('reception.totalPallets', 'Palettes')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-4">
                    {/* Quick preset buttons */}
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => setCratesPerPallet(42)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          cratesPerPallet === 42
                            ? 'bg-orange-600 text-white'
                            : 'bg-white text-orange-600 border border-orange-300 hover:bg-orange-50'
                        }`}
                      >
                        42
                      </button>
                      <button
                        onClick={() => setCratesPerPallet(36)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          cratesPerPallet === 36
                            ? 'bg-orange-600 text-white'
                            : 'bg-white text-orange-600 border border-orange-300 hover:bg-orange-50'
                        }`}
                      >
                        36
                      </button>
                      <button
                        onClick={() => setCratesPerPallet(30)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          cratesPerPallet === 30
                            ? 'bg-orange-600 text-white'
                            : 'bg-white text-orange-600 border border-orange-300 hover:bg-orange-50'
                        }`}
                      >
                        30
                      </button>
                      <button
                        onClick={() => setCratesPerPallet(24)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          cratesPerPallet === 24
                            ? 'bg-orange-600 text-white'
                            : 'bg-white text-orange-600 border border-orange-300 hover:bg-orange-50'
                        }`}
                      >
                        24
                      </button>
                    </div>
                    
                    {/* Slider for fine-tuning */}
                    <div className="px-4">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                        <span>1</span>
                        <span className="font-medium">{t('reception.cratesPerPallet', 'Caisses par palette')}</span>
                        <span>42</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="42"
                        value={cratesPerPallet}
                        onChange={(e) => setCratesPerPallet(parseInt(e.target.value))}
                        className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #fb923c 0%, #fb923c ${((cratesPerPallet - 1) / 41) * 100}%, #fed7aa ${((cratesPerPallet - 1) / 41) * 100}%, #fed7aa 100%)`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pallet Visualization */}
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {palletCalculation.totalPallets}
                    </div>
                    <div className="text-sm text-blue-700">
                      {t('reception.totalPallets', 'Palettes totales')}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {palletCalculation.fullPallets}
                    </div>
                    <div className="text-sm text-green-700">
                      {t('reception.fullPallets', 'Palettes complètes')}
                    </div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-orange-600 mb-1">
                      {palletCalculation.remainingCrates}
                    </div>
                    <div className="text-sm text-orange-700">
                      {t('reception.remainingCrates', 'Caisses restantes')}
                    </div>
                  </div>
                </div>

                {/* Visual Pallet Representation */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t('reception.palletVisualization', 'Visualisation des palettes')}
                  </h3>
                  
                  {/* All Pallets with Custom Editing */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {t('reception.palletVisualization', 'Visualisation des palettes')}
                      </h3>
                      <button
                        onClick={resetCustomCrates}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {t('reception.resetToDefault', 'Réinitialiser')}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {palletCalculation.pallets.map((pallet, i) => (
                        <div
                          key={`pallet-${i}`}
                          className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                            pallet.isCustom 
                              ? 'border-blue-300 bg-blue-50' 
                              : pallet.isFull 
                                ? 'border-green-300 bg-green-50' 
                                : 'border-orange-300 bg-orange-50'
                          }`}
                          style={{
                            animation: `fadeInUp 0.6s ease-out ${i * 0.1}s both`,
                            animationFillMode: 'both'
                          }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${
                                pallet.isCustom ? 'bg-blue-500' : pallet.isFull ? 'bg-green-500' : 'bg-orange-500'
                              }`}></div>
                              <span className="font-semibold text-gray-800">
                                Palette #{pallet.number}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {pallet.reference}
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium text-gray-700">
                                {t('reception.crates', 'Caisses')}:
                              </label>
                              <input
                                type="number"
                                min="1"
                                max={selectedReception?.totalCrates || 1000}
                                value={pallet.crates}
                                onChange={(e) => handleCustomCrateChange(pallet.number, parseInt(e.target.value) || 0)}
                                className="w-20 px-2 py-1 text-center border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            
                            <div className="text-center">
                              <div className={`text-2xl font-bold ${
                                pallet.isCustom ? 'text-blue-600' : pallet.isFull ? 'text-green-600' : 'text-orange-600'
                              }`}>
                                {pallet.crates}
                              </div>
                              <div className="text-xs text-gray-500">
                                {pallet.isCustom ? 'Personnalisé' : pallet.isFull ? 'Complète' : 'Partielle'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Progress Bar */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span className="font-medium">{t('reception.totalCrates', 'Total caisses')}</span>
                    <span className="font-bold text-orange-600">
                      {palletCalculation.totalCratesUsed || selectedReception.totalCrates} / {selectedReception.totalCrates}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 via-green-500 to-orange-500 h-4 rounded-full transition-all duration-1000 ease-out relative"
                      style={{
                        width: `${Math.min(100, ((palletCalculation.totalCratesUsed || selectedReception.totalCrates) / selectedReception.totalCrates) * 100)}%`
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    {Math.round(((palletCalculation.totalCratesUsed || selectedReception.totalCrates) / selectedReception.totalCrates) * 100)}% {t('reception.complete', 'complété')}
                  </div>
                  {palletCalculation.totalCratesUsed !== selectedReception.totalCrates && (
                    <div className="text-xs text-amber-600 text-center">
                      ⚠️ {selectedReception.totalCrates - (palletCalculation.totalCratesUsed || 0)} caisses non distribuées
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowPalletModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  {t('common.close', 'Fermer')}
                </button>
                
                {/* Save Button */}
                <button
                  onClick={() => savePalletCollection.mutate()}
                  disabled={isPalletDataSaved || savePalletCollection.isLoading}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                    isPalletDataSaved
                      ? 'text-green-700 bg-green-100 cursor-not-allowed'
                      : 'text-white bg-blue-600 hover:bg-blue-700 transform hover:scale-105 active:scale-95'
                  }`}
                >
                  {savePalletCollection.isLoading 
                    ? t('common.saving', 'Sauvegarde...') 
                    : isPalletDataSaved 
                      ? t('reception.saved', 'Sauvegardé ✓') 
                      : t('reception.savePalletData', 'Sauvegarder')
                  }
                </button>
                
                <button
                  onClick={async () => {
                    await generatePalletTickets();
                    setShowPalletModal(false);
                  }}
                  className="flex-1 px-4 py-3 text-white bg-orange-600 hover:bg-orange-700 rounded-lg font-medium transition-colors transform hover:scale-105 active:scale-95"
                >
                  {t('reception.generatePalletTicket', 'Générer ticket palette')}
                </button>
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
};
