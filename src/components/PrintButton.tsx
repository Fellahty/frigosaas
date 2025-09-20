import React from 'react';

interface PrintButtonProps {
  data: any[];
  columns: any[];
  title: string;
  subtitle: string;
  documentCode?: string;
  version?: string;
  date?: string;
  companyName?: string;
  className?: string;
  type?: 'vehicle' | 'cleaning' | 'trucks';
}

export const PrintButton: React.FC<PrintButtonProps> = ({
  data,
  columns,
  title,
  subtitle,
  documentCode = "F-01-PR-07-03",
  version = "01",
  date = new Date().toLocaleDateString('fr-FR'),
  companyName = "LYAZAMI",
  className = "",
  type = 'vehicle'
}) => {
  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Prepare table data based on type
    let tableColumns: string[] = [];
    let tableData: string[][] = [];
    
    if (type === 'vehicle') {
      tableColumns = ['Date', 'Nº Véhicule', 'Etat de Propreté', 'Contrôleur', 'Superviseur'];
      tableData = data.map(item => [
        new Date(item.date).toLocaleDateString('fr-FR'),
        item.vehicleNumber || '',
        item.cleanlinessState === 'clean' ? 'Propre' : 'Sale',
        item.controller || '',
        item.supervisor || ''
      ]);
    } else if (type === 'cleaning') {
      tableColumns = ['Elément à nettoyer', 'Opération', 'Date', 'Opérateur', 'Responsable', 'Photo'];
      tableData = data.map(item => [
        item.elementToClean || '',
        item.operation === 'cleaning' ? 'Nettoyage' : 
        item.operation === 'disinfection' ? 'Désinfection' : 'Maintenance',
        new Date(item.date).toLocaleDateString('fr-FR'),
        item.operator || '',
        item.responsible || '',
        item.photoUrl ? 'Oui' : 'Non'
      ]);
    } else if (type === 'trucks') {
      tableColumns = ['Nº Véhicule', 'Couleur', 'Dernière visite', 'Nombre de visites', 'Statut'];
      tableData = data.map(item => [
        item.number || '',
        item.color || '',
        item.lastVisit ? new Date(item.lastVisit).toLocaleDateString('fr-FR') : 'Jamais',
        item.visitCount?.toString() || '0',
        item.isActive ? 'Actif' : 'Inactif'
      ]);
    }

    // Create HTML content for printing in modern professional ONSSA format
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          @page { 
            size: A4 portrait; 
            margin: 15mm;
          }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 0;
            font-size: 11px;
            line-height: 1.4;
            color: #2c3e50;
            background: #fff;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 25px;
            align-items: flex-start;
            border-bottom: 3px solid #3498db;
            padding-bottom: 15px;
          }
          .company-section {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
          }
          .company-logo { 
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            padding: 12px 20px; 
            border-radius: 8px;
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .company-info {
            font-size: 10px;
            color: #7f8c8d;
            line-height: 1.3;
          }
          .document-info { 
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            width: 180px;
            text-align: left;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .document-info h3 {
            margin: 0 0 10px 0;
            font-size: 12px;
            color: #2c3e50;
            font-weight: bold;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 5px;
          }
          .document-info p {
            margin: 3px 0;
            font-size: 10px;
            color: #495057;
          }
          .main-title { 
            font-size: 20px; 
            font-weight: 700; 
            margin: 20px 0 8px 0;
            text-align: center;
            color: #2c3e50;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .subtitle { 
            font-size: 14px; 
            margin-bottom: 20px;
            text-align: center;
            color: #7f8c8d;
            font-weight: 500;
            font-style: italic;
          }
          .table-container {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin: 20px 0;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 0;
            font-size: 11px;
          }
          th { 
            background: linear-gradient(135deg, #34495e, #2c3e50);
            color: white;
            padding: 12px 10px; 
            text-align: left;
            vertical-align: middle;
            font-weight: 600;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: none;
          }
          td { 
            padding: 10px;
            text-align: left;
            vertical-align: middle;
            border-bottom: 1px solid #e9ecef;
            font-size: 11px;
            color: #495057;
          }
          tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          tr:hover {
            background-color: #e3f2fd;
          }
          .status-clean {
            background-color: #d4edda;
            color: #155724;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 10px;
          }
          .status-dirty {
            background-color: #f8d7da;
            color: #721c24;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 10px;
          }
          .status-active {
            background-color: #d1ecf1;
            color: #0c5460;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 10px;
          }
          .status-inactive {
            background-color: #f8d7da;
            color: #721c24;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 10px;
          }
          .footer { 
            margin-top: 30px; 
            font-size: 9px; 
            color: #6c757d;
            text-align: center;
            border-top: 2px solid #e9ecef;
            padding-top: 15px;
          }
          .onssa-badge {
            display: inline-block;
            background: linear-gradient(135deg, #27ae60, #2ecc71);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 9px;
            font-weight: bold;
            margin-left: 10px;
          }
          .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #6c757d;
            font-style: italic;
          }
          .signature-section {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            border-top: 1px solid #dee2e6;
            padding-top: 20px;
          }
          .signature-box {
            width: 200px;
            text-align: center;
          }
          .signature-line {
            border-bottom: 1px solid #6c757d;
            height: 30px;
            margin-bottom: 5px;
          }
          .signature-label {
            font-size: 10px;
            color: #6c757d;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-section">
            <div class="company-logo">
              ${companyName}
            </div>
            <div class="company-info">
              Système de Gestion de la Qualité<br>
              Conforme aux normes ONSSA
            </div>
          </div>
          <div class="document-info">
            <h3>Informations du Document</h3>
            <p><strong>Code:</strong> ${documentCode}</p>
            <p><strong>Version:</strong> ${version}</p>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Type:</strong> <span class="onssa-badge">ONSSA</span></p>
          </div>
        </div>
        
        <div class="main-title">${title}</div>
        <div class="subtitle">${subtitle}</div>
        
        <div class="table-container">
          <table>
            <thead>
              <tr>
                ${tableColumns.map(col => `<th>${col}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${tableData.map((row, index) => 
                `<tr>${row.map((cell, cellIndex) => {
                  // Add status styling for specific columns
                  if (type === 'vehicle' && cellIndex === 2) {
                    const statusClass = cell === 'Propre' ? 'status-clean' : 'status-dirty';
                    return `<td><span class="${statusClass}">${cell}</span></td>`;
                  } else if (type === 'trucks' && cellIndex === 4) {
                    const statusClass = cell === 'Actif' ? 'status-active' : 'status-inactive';
                    return `<td><span class="${statusClass}">${cell}</span></td>`;
                  } else if (type === 'cleaning' && cellIndex === 1) {
                    const statusClass = cell === 'Nettoyage' ? 'status-clean' : 
                                      cell === 'Désinfection' ? 'status-active' : 'status-dirty';
                    return `<td><span class="${statusClass}">${cell}</span></td>`;
                  }
                  return `<td>${cell}</td>`;
                }).join('')}</tr>`
              ).join('')}
              ${tableData.length === 0 ? `
                <tr>
                  <td colspan="${tableColumns.length}" class="empty-state">
                    Aucune donnée disponible pour cette période
                  </td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
        
        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">Contrôleur / Opérateur</div>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">Superviseur / Responsable</div>
          </div>
        </div>
        
        <div class="footer">
          <strong>${companyName}</strong> - Système de Gestion de la Qualité<br>
          Document généré le ${new Date().toLocaleString('fr-FR')} | Conforme aux normes ONSSA
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <button
      onClick={handlePrint}
      className={`inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-105 transition-all duration-200 font-medium text-sm ${className}`}
    >
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      <span className="font-semibold">Imprimer</span>
    </button>
  );
};
