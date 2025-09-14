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
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 1mm; letter-spacing: 1px;">Entrepôt frigorifique LYAZAMI</div>
        <div style="font-size: 12px; font-weight: bold; margin-bottom: 1mm;">TICKET DE RÉCEPTION</div>
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
        <div> Entrepôt frigorifique LYAZAMI</div>
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
  const [editingDriverId, setEditingDriverId] = React.useState<string | null>(null);
  const [editingProductId, setEditingProductId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    clientId: '',
    truckId: '',
    driverId: '',
    productId: '',
    roomId: '',
    totalCrates: 0,
    notes: '',
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
      const selectedDriver = drivers?.find(d => d.id === payload.driverId);
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
        driverId: payload.driverId,
        driverName: selectedDriver?.name || '',
        driverPhone: selectedDriver?.phone || '',
        productId: payload.productId,
        productName: selectedProduct?.name || '',
        productVariety: selectedProduct?.variety || '',
        roomId: payload.roomId,
        roomName: selectedRoom?.room || '',
        totalCrates: payload.totalCrates,
        notes: payload.notes,
        status: 'pending',
        arrivalTime: Timestamp.fromDate(new Date()),
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
        notes: '',
      });
    },
  });

  const updateReception = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & typeof form) => {
      const selectedClient = clients?.find(c => c.id === payload.clientId);
      const selectedTruck = trucks?.find(t => t.id === payload.truckId);
      const selectedDriver = drivers?.find(d => d.id === payload.driverId);
      const selectedProduct = products?.find(p => p.id === payload.productId);
      const selectedRoom = rooms?.find(r => r.id === payload.roomId);

      await updateDoc(doc(db, 'receptions', id), {
        clientId: payload.clientId,
        clientName: selectedClient?.name || '',
        truckId: payload.truckId,
        truckNumber: selectedTruck?.number || '',
        driverId: payload.driverId,
        driverName: selectedDriver?.name || '',
        driverPhone: selectedDriver?.phone || '',
        productId: payload.productId,
        productName: selectedProduct?.name || '',
        productVariety: selectedProduct?.variety || '',
        roomId: payload.roomId,
        roomName: selectedRoom?.room || '',
        totalCrates: payload.totalCrates,
        notes: payload.notes,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['receptions', tenantId] });
      setEditingReceptionId(null);
      await logUpdate('reception', editingReceptionId!, 'Réception modifiée', 'admin', 'Administrateur');
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
      notes: reception.notes || '',
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
              <div class="company-name">Entrepôt frigorifique LYAZAMI</div>
              <div class="ticket-title">TICKET DE RÉCEPTION</div>
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
              <div>Entrepôt frigorifique LYAZAMI</div>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.driver', 'Chauffeur')}</label>
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
                    setEditingDriverId(driverId);
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
                    setEditingProductId(productId);
                    setIsAddingProduct(true);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('reception.room', 'Chambre')}</label>
              <EnhancedSelect
                value={form.roomId}
                onChange={(value) => setForm((f) => ({ ...f, roomId: value }))}
                placeholder={t('reception.selectRoom', 'Sélectionner une chambre')}
                options={rooms?.map(room => ({
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
              disabled={!form.clientId || !form.truckId || !form.driverId || !form.productId || addReception.isLoading}
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
                  notes: '',
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


      {/* Receptions Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-full text-xs">
            <TableHead>
              <TableRow className="bg-gray-50">
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('reception.print', 'Imprimer')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('reception.serial', 'N° Ticket')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('reception.client', 'Client')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('reception.totalCrates', 'Caisses')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('reception.arrivalTime', 'Date/Heure')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('reception.truckNumber', 'Camion')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('reception.driverName', 'Chauffeur')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('reception.product', 'Produit')}</TableHeader>
                <TableHeader className="px-3 py-2 text-left font-semibold text-gray-700">{t('reception.room', 'Chambre')}</TableHeader>
                <TableHeader className="px-3 py-2 text-center font-semibold text-gray-700">{t('reception.actions', 'Actions')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.isArray(receptions) && receptions.length > 0 ? (
                receptions.map((r) => (
                  <TableRow key={r.id} id={`reception-${r.id}`} className="hover:bg-gray-50 border-b border-gray-200">
                    <TableCell className="px-3 py-2 text-center">
                      <button
                        onClick={() => handlePrintTicket(r)}
                        className="inline-flex items-center justify-center w-8 h-8 text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                        title={t('reception.print', 'Imprimer') as string}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                      </button>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center font-mono text-xs text-gray-600">
                      {r.serial || 'N/A'}
                    </TableCell>
                    <TableCell className="px-3 py-2 font-medium text-gray-900 truncate max-w-[120px]">
                      <span title={r.clientName}>{r.clientName}</span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {r.totalCrates}
                      </span>
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
    </div>
  );
};
