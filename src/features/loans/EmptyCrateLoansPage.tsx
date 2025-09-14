import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, Timestamp, query, where, updateDoc, doc, getDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { Spinner } from '../../components/Spinner';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import QRCode from 'qrcode';
import { type GeneralSettings } from '../../types/settings';

type LoanStatus = 'open' | 'returned';

interface LoanItem {
  id: string;
  ticketId: string;
  clientId: string | null;
  clientName: string;
  crates: number;
  depositMad: number;
  depositType?: 'cash' | 'check';
  depositReference?: string;
  depositPhoto?: string;
  status: LoanStatus;
  createdAt: Date;
}

interface ClientOption { id: string; name: string }

interface ClientStats {
  totalReservedCrates: number;
  totalEmptyCratesNeeded: number;
  activeReservations: number;
  closedReservations: number;
}

// Component for displaying client information
const ClientInfoDisplay: React.FC<{ 
  clientStats: ClientStats; 
  onNavigateToReservations: () => void;
}> = ({ clientStats, onNavigateToReservations }) => {
  const { t } = useTranslation();
  
  return (
    <div className="md:col-span-2 lg:col-span-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('loans.clientInfo.title', 'Informations du client')}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{clientStats.totalReservedCrates}</div>
            <div className="text-xs text-blue-700">{t('loans.clientInfo.reservedCrates', 'Caisses réservées')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{clientStats.totalEmptyCratesNeeded}</div>
            <div className="text-xs text-green-700">{t('loans.clientInfo.emptyCratesNeeded', 'Caisses vides nécessaires')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{clientStats.activeReservations}</div>
            <div className="text-xs text-orange-700">{t('loans.clientInfo.activeReservations', 'Réservations actives')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{clientStats.closedReservations}</div>
            <div className="text-xs text-gray-700">{t('loans.clientInfo.closedReservations', 'Réservations fermées')}</div>
          </div>
        </div>
        
        {/* Action button when no reservations */}
        {clientStats.totalReservedCrates === 0 && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="text-center">
              <p className="text-sm text-blue-700 mb-3">
                {t('loans.clientInfo.noReservations', 'Ce client n\'a aucune réservation active')}
              </p>
              <button
                onClick={onNavigateToReservations}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {t('loans.clientInfo.goToReservations', 'Aller aux réservations')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const EmptyCrateLoansPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Get site settings for company name
  const { data: siteSettings } = useQuery({
    queryKey: ['site-settings', tenantId],
    queryFn: async (): Promise<{ name: string }> => {
      const docRef = doc(db, 'tenants', tenantId, 'settings', 'site');
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return { name: 'Frigo SaaS' };
      }
      return docSnap.data() as { name: string };
    },
  });

  const [isAdding, setIsAdding] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingLoan, setEditingLoan] = React.useState<LoanItem | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = React.useState(false);
  const [loanToReturn, setLoanToReturn] = React.useState<LoanItem | null>(null);
  const [form, setForm] = React.useState<{ 
    clientId: string; 
    crates: number; 
    depositMad: number;
    depositType: 'cash' | 'check';
    depositReference: string;
    depositPhoto: string;
  }>({
    clientId: '',
    crates: 1,
    depositMad: 0,
    depositType: 'cash',
    depositReference: '',
    depositPhoto: '',
  });

  const { data: clientOptions } = useQuery({
    queryKey: ['clients', tenantId, 'for-loans'],
    queryFn: async (): Promise<ClientOption[]> => {
      const q = query(collection(db, 'tenants', tenantId, 'clients'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, name: (d.data() as any).name || '—' }));
    },
  });

  // Get client reservation information
  const { data: clientReservations } = useQuery({
    queryKey: ['client-reservations', tenantId, form.clientId],
    queryFn: async () => {
      if (!form.clientId) return null;
      const q = query(
        collection(db, 'tenants', tenantId, 'reservations'),
        where('clientId', '==', form.clientId),
        where('status', 'in', ['APPROVED', 'CLOSED'])
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },
    enabled: !!form.clientId,
  });

  // Calculate client statistics
  const clientStats = React.useMemo(() => {
    if (!clientReservations || clientReservations.length === 0) {
      return {
        totalReservedCrates: 0,
        totalEmptyCratesNeeded: 0,
        activeReservations: 0,
        closedReservations: 0
      };
    }

    const stats = clientReservations.reduce((acc, reservation) => {
      const reservedCrates = reservation.reservedCrates || 0;
      acc.totalReservedCrates += reservedCrates;
      acc.totalEmptyCratesNeeded += reservedCrates; // Assuming each reserved crate needs an empty crate
      
      if (reservation.status === 'APPROVED') {
        acc.activeReservations += 1;
      } else if (reservation.status === 'CLOSED') {
        acc.closedReservations += 1;
      }
      
      return acc;
    }, {
      totalReservedCrates: 0,
      totalEmptyCratesNeeded: 0,
      activeReservations: 0,
      closedReservations: 0
    });

    return stats;
  }, [clientReservations]);

  // Récupérer les paramètres des caisses vides
  const { data: poolSettings } = useQuery({
    queryKey: ['pool-settings', tenantId],
    queryFn: async () => {
      const docRef = doc(db, 'tenants', tenantId, 'settings', 'pool');
      const docSnap = await getDocs(collection(db, 'tenants', tenantId, 'settings'));
      const poolDoc = docSnap.docs.find(d => d.id === 'pool');
      return poolDoc ? poolDoc.data() : { pool_vides_total: 0, seuil_alerte_vides: 0 };
    },
  });

  // Récupérer les paramètres de tarification pour la caution par caisse
  const { data: pricingSettings } = useQuery({
    queryKey: ['pricing-settings', tenantId],
    queryFn: async () => {
      const docRef = doc(db, 'tenants', tenantId, 'settings', 'pricing');
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : { caution_par_caisse: 0 };
    },
  });

  const { data: loans, isLoading, error } = useQuery({
    queryKey: ['empty-crate-loans', tenantId],
    queryFn: async (): Promise<LoanItem[]> => {
      const q = query(collection(db, 'empty_crate_loans'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          ticketId: data.ticketId || '',
          clientId: data.clientId || null,
          clientName: data.clientName || '',
          crates: Number(data.crates) || 0,
          depositMad: Number(data.depositMad) || 0,
          depositType: data.depositType || 'cash',
          depositReference: data.depositReference || '',
          depositPhoto: data.depositPhoto || '',
          status: (data.status as LoanStatus) || 'open',
          createdAt: data.createdAt?.toDate?.() || new Date(),
        };
      });
      // newest first
      return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    refetchInterval: 15000,
  });

  // Calculer les caisses vides disponibles (total - prêts en cours)
  const availableEmptyCrates = React.useMemo(() => {
    if (!poolSettings?.pool_vides_total || !loans) return 0;
    
    const totalLoaned = loans
      .filter(loan => loan.status === 'open')
      .reduce((sum, loan) => sum + loan.crates, 0);
    
    return Math.max(0, poolSettings.pool_vides_total - totalLoaned);
  }, [poolSettings?.pool_vides_total, loans]);

  // Calculer la caution totale basée sur le nombre de caisses et le tarif par caisse
  const calculateTotalCaution = React.useCallback((crates: number) => {
    const cautionParCaisse = pricingSettings?.caution_par_caisse || 0;
    return crates * cautionParCaisse;
  }, [pricingSettings?.caution_par_caisse]);

  // Mettre à jour automatiquement la caution quand le nombre de caisses change
  React.useEffect(() => {
    if (form.crates > 0 && pricingSettings?.caution_par_caisse) {
      const totalCaution = calculateTotalCaution(form.crates);
      setForm(prev => ({ ...prev, depositMad: totalCaution }));
    }
  }, [form.crates, calculateTotalCaution, pricingSettings?.caution_par_caisse]);

  const addLoan = useMutation({
    mutationFn: async (payload: typeof form) => {
      const client = (clientOptions || []).find((c) => c.id === payload.clientId);
      const ticketId = `${tenantId}-${Date.now()}`;
      await addDoc(collection(db, 'empty_crate_loans'), {
        tenantId,
        ticketId,
        clientId: payload.clientId || null,
        clientName: client?.name || '',
        crates: Number(payload.crates) || 0,
        depositMad: Number(payload.depositMad) || 0,
        depositType: payload.depositType || 'cash',
        depositReference: payload.depositReference || '',
        depositPhoto: payload.depositPhoto || '',
        status: 'open',
        createdAt: Timestamp.fromDate(new Date()),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['empty-crate-loans', tenantId] });
      setIsAdding(false);
      setForm({ 
        clientId: '', 
        crates: 1, 
        depositMad: 0, 
        depositType: 'cash', 
        depositReference: '', 
        depositPhoto: '' 
      });
    },
  });

  const editLoan = useMutation({
    mutationFn: async (payload: { id: string; updates: typeof form }) => {
      const client = (clientOptions || []).find((c) => c.id === payload.updates.clientId);
      await updateDoc(doc(db, 'empty_crate_loans', payload.id), {
        clientId: payload.updates.clientId || null,
        clientName: client?.name || '',
        crates: Number(payload.updates.crates) || 0,
        depositMad: Number(payload.updates.depositMad) || 0,
        depositType: payload.updates.depositType || 'cash',
        depositReference: payload.updates.depositReference || '',
        depositPhoto: payload.updates.depositPhoto || '',
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['empty-crate-loans', tenantId] });
      setIsEditing(false);
      setEditingLoan(null);
    },
  });

  const markReturned = useMutation({
    mutationFn: async (item: LoanItem) => {
      await updateDoc(doc(db, 'empty_crate_loans', item.id), { status: 'returned' });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['empty-crate-loans', tenantId] });
    },
  });

  const handleEditLoan = (item: LoanItem) => {
    setEditingLoan(item);
    setForm({
      clientId: item.clientId || '',
      crates: item.crates,
      depositMad: item.depositMad,
      depositType: item.depositType || 'cash',
      depositReference: item.depositReference || '',
      depositPhoto: item.depositPhoto || '',
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editingLoan) {
      editLoan.mutate({
        id: editingLoan.id,
        updates: form
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingLoan(null);
    setForm({
      clientId: '',
      crates: 1,
      depositMad: 0,
      depositType: 'cash',
      depositReference: '',
      depositPhoto: '',
    });
  };

  const handleMarkReturned = (item: LoanItem) => {
    setLoanToReturn(item);
    setIsConfirmModalOpen(true);
  };

  const confirmReturn = () => {
    if (loanToReturn) {
      markReturned.mutate(loanToReturn);
      setIsConfirmModalOpen(false);
      setLoanToReturn(null);
    }
  };

  const cancelReturn = () => {
    setIsConfirmModalOpen(false);
    setLoanToReturn(null);
  };

  const getConfirmMessage = (item: LoanItem) => {
    if (i18n.language === 'ar') {
      return `هل أنت متأكد من أن الصناديق قد رجعت إلى المخزن والضمان ${item.depositMad.toFixed(2)} درهم تم إرجاعه للعميل؟`;
    }
    return `Êtes-vous sûr que les caisses sont rentrées au frigo et la caution ${item.depositMad.toFixed(2)} MAD a été retournée au client ?`;
  };

  // Handle print ticket for thermal POS-80 printer
  const handlePrintTicket = (item: LoanItem) => {
    const currentDate = new Date();
    const qrUrl = `${window.location.origin}/loan?ticket=${item.ticketId}`;
    
    // Try to open print window
    const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes,resizable=yes');
    
    if (!printWindow) {
      // Fallback: use current window
      console.log('Popup blocked, using current window for printing');
      printTicketInCurrentWindow(item, qrUrl, currentDate);
      return;
    }

    // Write the HTML content
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket de Prêt - ${item.clientName}</title>
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
              font-size: 10px; 
              margin: 0; 
              padding: 0; 
              background: white;
            }
            .ticket { 
              width: 80mm; 
              margin: 0 auto; 
              padding: 2mm; 
              border: 1px solid #000;
            }
            .header { 
              text-align: center; 
              border-bottom: 1px solid #000; 
              padding-bottom: 3mm; 
              margin-bottom: 3mm; 
            }
            .title { 
              font-size: 14px; 
              font-weight: bold; 
              margin-bottom: 1mm; 
              letter-spacing: 1px; 
            }
            .subtitle { 
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
            .qr-section { 
              text-align: center; 
              margin: 2mm 0; 
              padding: 2mm; 
              border: 1px dashed #000; 
            }
            .qr-label { 
              text-align: center; 
              font-size: 8px; 
              margin-bottom: 1mm; 
            }
            .qr-code { 
              text-align: center; 
              font-family: monospace; 
              font-size: 10px; 
              font-weight: bold; 
            }
            .footer { 
              text-align: center; 
              margin: 2mm 0; 
              font-size: 8px; 
            }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <div class="title">${siteSettings?.name || 'Entrepôt frigorifique LYAZAMI'}</div>
            <div class="subtitle">TICKET DE PRÊT CAISSES VIDES</div>
            <div class="ticket-number">N° ${item.ticketId}</div>
          </div>
          
          <div class="section">
            <div class="section-title">Informations</div>
            <div class="row">
              <span class="label">Date:</span>
              <span class="value">${currentDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
            </div>
            <div class="row">
              <span class="label">Heure:</span>
              <span class="value">${currentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Client</div>
            <div class="row">
              <span class="label">Nom:</span>
              <span class="value">${item.clientName}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Prêt</div>
            <div class="row">
              <span class="label">Caisses vides:</span>
              <span class="value">${item.crates}</span>
            </div>
            <div class="row">
              <span class="label">Caution:</span>
              <span class="value">${item.depositMad.toFixed(2)} MAD</span>
            </div>
          </div>
          
          <div class="highlight">
            <div style="text-align: center;">CAISSES PRÊTÉES: ${item.crates}</div>
          </div>
          
          <div class="qr-section">
            <div class="qr-label">Code de suivi</div>
            <div class="qr-code">${item.ticketId}</div>
            <div style="text-align: center; margin-top: 2mm;">
              <div id="qrcode" style="display: inline-block;"></div>
            </div>
          </div>
          
          <div class="footer">═══════════════════════════════</div>
          <div class="footer">Merci pour votre confiance</div>
          <div class="footer">${siteSettings?.name || 'Entrepôt frigorifique LYAZAMI'} - Gestion Frigorifique</div>
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

  // Fallback function for printing in current window
  const printTicketInCurrentWindow = (item: LoanItem, qrUrl: string, currentDate: Date) => {
    const printContent = `
      <div style="font-family: 'Courier New', monospace; font-size: 10px; width: 80mm; margin: 0 auto; padding: 2mm; border: 1px solid #000;">
        <div style="text-align: center; border-bottom: 1px solid #000; padding-bottom: 3mm; margin-bottom: 3mm;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 1mm; letter-spacing: 1px;">${siteSettings?.name || 'Frigo SaaS'}</div>
          <div style="font-size: 12px; font-weight: bold; margin-bottom: 1mm;">TICKET DE PRÊT CAISSES VIDES</div>
          <div style="font-size: 10px; color: #666; margin-bottom: 2mm;">N° ${item.ticketId}</div>
        </div>
        
        <div style="margin: 2mm 0; border: 1px solid #000; padding: 2mm;">
          <div style="font-weight: bold; font-size: 10px; margin-bottom: 1mm; text-decoration: underline; text-transform: uppercase;">Informations</div>
          <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
            <span style="font-weight: bold; flex: 1;">Date:</span>
            <span style="text-align: right; flex: 1; font-weight: normal;">${currentDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
            <span style="font-weight: bold; flex: 1;">Heure:</span>
            <span style="text-align: right; flex: 1; font-weight: normal;">${currentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        
        <div style="margin: 2mm 0; border: 1px solid #000; padding: 2mm;">
          <div style="font-weight: bold; font-size: 10px; margin-bottom: 1mm; text-decoration: underline; text-transform: uppercase;">Client</div>
          <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
            <span style="font-weight: bold; flex: 1;">Nom:</span>
            <span style="text-align: right; flex: 1; font-weight: normal;">${item.clientName}</span>
          </div>
        </div>
        
        <div style="margin: 2mm 0; border: 1px solid #000; padding: 2mm;">
          <div style="font-weight: bold; font-size: 10px; margin-bottom: 1mm; text-decoration: underline; text-transform: uppercase;">Prêt</div>
          <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
            <span style="font-weight: bold; flex: 1;">Caisses vides:</span>
            <span style="text-align: right; flex: 1; font-weight: normal;">${item.crates}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 1mm 0; padding: 0.5mm 0; font-size: 9px;">
            <span style="font-weight: bold; flex: 1;">Caution:</span>
            <span style="text-align: right; flex: 1; font-weight: normal;">${item.depositMad.toFixed(2)} MAD</span>
          </div>
        </div>
        
        <div style="background-color: #000; color: white; padding: 1mm 2mm; font-weight: bold; text-align: center; margin: 1mm 0;">
          <div style="text-align: center;">CAISSES PRÊTÉES: ${item.crates}</div>
        </div>
        
        <div style="text-align: center; margin: 2mm 0; padding: 2mm; border: 1px dashed #000;">
          <div style="text-align: center; font-size: 8px; margin-bottom: 1mm;">Code de suivi</div>
          <div style="text-align: center; font-family: monospace; font-size: 10px; font-weight: bold;">${item.ticketId}</div>
          <div style="text-align: center; margin-top: 2mm;">
            <div id="qrcode-fallback" style="display: inline-block;"></div>
          </div>
        </div>
        
        <div style="text-align: center; margin: 2mm 0; font-size: 8px;">═══════════════════════════════</div>
        <div style="text-align: center; margin: 2mm 0; font-size: 8px;">Merci pour votre confiance</div>
        <div style="text-align: center; margin: 2mm 0; font-size: 8px;">${siteSettings?.name || 'Frigo SaaS'} - Gestion Frigorifique</div>
      </div>
    `;
    
    // Create a print div
    const printDiv = document.createElement('div');
    printDiv.innerHTML = printContent;
    printDiv.style.position = 'absolute';
    printDiv.style.left = '-9999px';
    printDiv.style.top = '0';
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-medium">{t('loans.errorLoading', 'Erreur de chargement')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-sm md:text-base">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{t('loans.title', 'Prêt caisses vides')}</h1>
          <p className="text-gray-600">{t('loans.subtitle', 'Gestion des tickets QR et caution')}</p>
        </div>
        <button onClick={() => setIsAdding((v) => !v)} className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12 4.5a.75.75 0 01.75.75V11h5.75a.75.75 0 010 1.5H12.75v5.75a.75.75 0 01-1.5 0V12.5H5.5a.75.75 0 010-1.5h5.75V5.25A.75.75 0 0112 4.5z" clipRule="evenodd" /></svg>
          {t('loans.add', 'Nouveau prêt')}
        </button>
      </div>

      {/* Résumé des caisses vides */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{t('loans.emptyCratesTitle', 'Caisses vides')}</h3>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-black text-gray-900 mb-1">
              {availableEmptyCrates.toLocaleString()}
            </div>
            <div className="text-sm font-medium text-gray-600 mb-2">
              {t('loans.availableEmptyCrates', 'Disponibles')}
            </div>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {t('loans.totalConfigured', 'Total')}: {poolSettings?.pool_vides_total?.toLocaleString() || 0}
            </div>
          </div>
        </div>
      </Card>

      {isAdding && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('billing.client', 'Client')}</label>
              <select
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">{t('billing.selectClient', 'Sélectionner un client')}</option>
                {(clientOptions || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            {/* Client Information Display */}
            {form.clientId && clientStats && (
              <ClientInfoDisplay 
                clientStats={clientStats} 
                onNavigateToReservations={() => navigate('/reservations')} 
              />
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.crates', 'Caisses')}</label>
              <input type="number" min={1} value={form.crates} onChange={(e) => setForm((f)=>({ ...f, crates: Number(e.target.value) }))} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('loans.deposit', 'Caution')}
                {pricingSettings?.caution_par_caisse && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({pricingSettings.caution_par_caisse} MAD/{t('loans.perCrate', 'caisse')})
                  </span>
                )}
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  min={0} 
                  step={0.01} 
                  value={form.depositMad} 
                  onChange={(e) => setForm((f)=>({ ...f, depositMad: Number(e.target.value) }))} 
                  className={`w-full border rounded-md px-3 py-2 ${pricingSettings?.caution_par_caisse ? 'bg-gray-50 text-gray-700' : 'bg-white'}`}
                  placeholder="0.00"
                  readOnly={!!pricingSettings?.caution_par_caisse}
                />
                {pricingSettings?.caution_par_caisse && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.depositType', 'Type de caution')}</label>
              <select
                value={form.depositType}
                onChange={(e) => setForm((f) => ({ ...f, depositType: e.target.value as 'cash' | 'check' }))}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="cash">{t('loans.cash', 'Espèces')}</option>
                <option value="check">{t('loans.check', 'Chèque')}</option>
              </select>
            </div>
            {form.depositType === 'check' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.checkReference', 'Référence chèque')}</label>
                  <input 
                    type="text" 
                    value={form.depositReference} 
                    onChange={(e) => setForm((f)=>({ ...f, depositReference: e.target.value }))} 
                    className="w-full border rounded-md px-3 py-2" 
                    placeholder={t('loans.checkReferencePlaceholder', 'N° chèque')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.depositPhoto', 'Photo de caution')}</label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setForm((f) => ({ ...f, depositPhoto: event.target?.result as string }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                      id="deposit-photo"
                    />
                    <label 
                      htmlFor="deposit-photo" 
                      className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm text-gray-600">
                        {form.depositPhoto ? t('loans.photoUploaded', 'Photo ajoutée') : t('loans.uploadPhoto', 'Ajouter photo')}
                      </span>
                    </label>
                    {form.depositPhoto && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, depositPhoto: '' }))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={() => addLoan.mutate(form)} disabled={!form.clientId || form.crates <=0 || addLoan.isLoading} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-60">
              {addLoan.isLoading ? t('common.loading') : t('common.save')}
            </button>
            <button onClick={() => setIsAdding(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200">{t('common.cancel')}</button>
          </div>
        </Card>
      )}

      {isEditing && (
        <Card>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('common.edit', 'Modifier')} - {editingLoan?.clientName}</h3>
            <p className="text-sm text-gray-600">{t('loans.editLoanInfo', 'Modifier toutes les informations du prêt')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('billing.client', 'Client')}</label>
              <select
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">{t('billing.selectClient', 'Sélectionner un client')}</option>
                {(clientOptions || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            {/* Client Information Display */}
            {form.clientId && clientStats && (
              <ClientInfoDisplay 
                clientStats={clientStats} 
                onNavigateToReservations={() => navigate('/reservations')} 
              />
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.crates', 'Caisses')}</label>
              <input type="number" min={1} value={form.crates} onChange={(e) => setForm((f)=>({ ...f, crates: Number(e.target.value) }))} className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('loans.deposit', 'Caution')}
                {pricingSettings?.caution_par_caisse && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({pricingSettings.caution_par_caisse} MAD/{t('loans.perCrate', 'caisse')})
                  </span>
                )}
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  min={0} 
                  step={0.01} 
                  value={form.depositMad} 
                  onChange={(e) => setForm((f)=>({ ...f, depositMad: Number(e.target.value) }))} 
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.depositType', 'Type de caution')}</label>
              <select
                value={form.depositType}
                onChange={(e) => setForm((f) => ({ ...f, depositType: e.target.value as 'cash' | 'check' }))}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="cash">{t('loans.cash', 'Espèces')}</option>
                <option value="check">{t('loans.check', 'Chèque')}</option>
              </select>
            </div>
            {form.depositType === 'check' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.checkReference', 'Référence chèque')}</label>
                  <input 
                    type="text" 
                    value={form.depositReference} 
                    onChange={(e) => setForm((f)=>({ ...f, depositReference: e.target.value }))} 
                    className="w-full border rounded-md px-3 py-2" 
                    placeholder={t('loans.checkReferencePlaceholder', 'N° chèque')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('loans.depositPhoto', 'Photo de caution')}</label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setForm((f) => ({ ...f, depositPhoto: event.target?.result as string }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                      id="edit-deposit-photo"
                    />
                    <label 
                      htmlFor="edit-deposit-photo" 
                      className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm text-gray-600">
                        {form.depositPhoto ? t('loans.photoUploaded', 'Photo ajoutée') : t('loans.uploadPhoto', 'Ajouter photo')}
                      </span>
                    </label>
                    {form.depositPhoto && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, depositPhoto: '' }))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={handleSaveEdit} disabled={!form.clientId || form.crates <=0 || editLoan.isLoading} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-60">
              {editLoan.isLoading ? t('common.loading') : t('common.save')}
            </button>
            <button onClick={handleCancelEdit} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200">{t('common.cancel')}</button>
          </div>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className="text-left">{t('billing.client', 'Client')}</TableHeader>
                <TableHeader className="text-center">{t('loans.crates', 'Caisses')}</TableHeader>
                <TableHeader className="text-center">{t('loans.deposit', 'Caution')}</TableHeader>
                <TableHeader className="text-center">{t('loans.depositType', 'Type')}</TableHeader>
                <TableHeader className="text-center hidden md:table-cell">{t('loans.checkReference', 'Référence')}</TableHeader>
                <TableHeader className="text-center hidden lg:table-cell">{t('loans.depositPhoto', 'Photo')}</TableHeader>
                <TableHeader className="text-center hidden sm:table-cell">{t('clients.created', 'Créé le')}</TableHeader>
                <TableHeader className="text-center">{t('billing.status', 'Statut')}</TableHeader>
                <TableHeader className="text-center">{t('billing.actions', 'Actions')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
            {Array.isArray(loans) && loans.length > 0 ? (
              loans.map((l) => (
                <TableRow key={l.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium text-sm sm:text-base">{l.clientName || '-'}</TableCell>
                  <TableCell className="text-center text-sm sm:text-base font-semibold">{l.crates}</TableCell>
                  <TableCell className="text-center text-sm sm:text-base">{l.depositMad.toFixed(2)} MAD</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      l.depositType === 'cash' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {t(`loans.${l.depositType}`, l.depositType)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center hidden md:table-cell text-sm">
                    {l.depositReference || '-'}
                  </TableCell>
                  <TableCell className="text-center hidden lg:table-cell">
                    {l.depositPhoto ? (
                      <button
                        onClick={() => {
                          const newWindow = window.open();
                          if (newWindow) {
                            newWindow.document.write(`
                              <html>
                                <head><title>${t('loans.depositPhoto', 'Photo de caution')}</title></head>
                                <body style="margin:0; padding:20px; text-align:center;">
                                  <img src="${l.depositPhoto}" style="max-width:100%; max-height:80vh;" alt="${t('loans.depositPhoto', 'Photo de caution')}">
                                </body>
                              </html>
                            `);
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        {t('common.view', 'Voir')}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell text-sm">{l.createdAt.toLocaleDateString(i18n.language)}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      l.status === 'open' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {t(`loans.status_${l.status}`, l.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handlePrintTicket(l)} className="px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs">{t('loans.ticket', 'Ticket')}</button>
                      {l.status === 'open' && (
                        <>
                          <button onClick={() => handleEditLoan(l)} className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs">{t('common.edit', 'Modifier')}</button>
                          <button onClick={() => handleMarkReturned(l)} className="px-2 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs">{t('loans.markReturned', 'Retourner')}</button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">{t('loans.empty', 'Aucun prêt')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={cancelReturn}
        onConfirm={confirmReturn}
        title={t('loans.confirmReturnTitle', 'Confirmer le retour')}
        message={loanToReturn ? getConfirmMessage(loanToReturn) : ''}
        confirmText={t('loans.confirmReturn', 'Confirmer le retour') as string}
        cancelText={t('common.cancel', 'Annuler') as string}
        type="warning"
        isLoading={markReturned.isLoading}
      />
    </div>
  );
};


