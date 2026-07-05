import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export type DesignFacture = 1 | 2 | 3;

export interface InvoiceLigne {
  designation?: string;
  produitNom?: string;
  quantite: number;
  prixUnitaire: number;
  remisePourcentage?: number;
  remiseMontant?: number;
  sousTotal?: number;
}

export interface InvoiceData {
  numero: string;
  date: string;
  clientNom?: string;
  clientPrenom?: string;
  clientTelephone?: string;
  clientAdresse?: string;
  vendeurNom?: string;
  modePaiement?: string;
  referencePaiement?: string;
  estCredit?: boolean;
  creditRegle?: boolean;
  montantVerse?: number;
  montantRestant?: number;
  dateEcheance?: string;
  notes?: string;
  lignes: InvoiceLigne[];
  montantTotal: number;
  montantApresRemise?: number;
  montantRemiseTotal?: number;
  statut?: string;
  id?: number;
  type?: 'FACTURE' | 'VENTE';
}

export interface ShopInfo {
  nom?: string;
  adresse?: string;
  ville?: string;
  telephone?: string;
  email?: string;
  numeroRc?: string;
  numeroIfu?: string;
  logoUrl?: string;
}

function formatPrice(value: number): string {
  if (!value && value !== 0) return '0 FCFA';
  return new Intl.NumberFormat('fr-FR').format(Math.round(value)) + ' FCFA';
}

function formatDate(d?: string): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return d; }
}

function getModePaiementLabel(mode?: string): string {
  const MAP: Record<string, string> = {
    ESPECES: 'Espèces', ORANGE_MONEY: 'Orange Money', MOOV_MONEY: 'Moov Money',
    WAVE_MONEY: 'Wave Money', CARTE_BANCAIRE: 'Carte bancaire', VIREMENT: 'Virement'
  };
  return mode ? (MAP[mode] || mode) : '—';
}

export function buildInvoiceHtml(inv: InvoiceData, shop: ShopInfo, design: DesignFacture = 1): string {
  const nom   = shop.nom    || 'Ges Boutique';
  const adr   = shop.adresse || '';
  const ville = shop.ville  || '';
  const tel   = shop.telephone || '';
  const email = shop.email  || '';
  const rc    = shop.numeroRc || '';
  const ifu   = shop.numeroIfu || '';

  const initial = (nom.charAt(0) || 'B').toUpperCase();
  const logoBlock = shop.logoUrl
    ? `<img src="${shop.logoUrl}" alt="${nom}" class="inv-logo-img" onerror="this.style.display='none'">`
    : `<div class="inv-logo-fallback">${initial}</div>`;

  const lignes = inv.lignes || [];
  const rows = lignes.map((item, i) => {
    const remise = item.remisePourcentage ? `${item.remisePourcentage}%`
      : item.remiseMontant ? formatPrice(item.remiseMontant) : '—';
    const sous = item.sousTotal ?? (item.quantite * item.prixUnitaire);
    return `<tr class="${i % 2 === 0 ? 'even' : ''}">
      <td class="td-name">${item.designation || item.produitNom || 'Produit'}</td>
      <td class="td-center">${item.quantite}</td>
      <td class="td-right">${formatPrice(item.prixUnitaire)}</td>
      <td class="td-center td-remise">${remise}</td>
      <td class="td-right td-bold">${formatPrice(sous)}</td>
    </tr>`;
  }).join('');

  const remiseTotal = inv.montantRemiseTotal || 0;
  const sousTotal = (inv.montantTotal || 0) + remiseTotal;
  const totalFinal = inv.montantApresRemise || inv.montantTotal || 0;

  const totauxRows = `
    <tr class="subtotal-row"><td colspan="4" class="td-right td-light">Sous-total</td><td class="td-right">${formatPrice(sousTotal)}</td></tr>
    ${remiseTotal > 0 ? `<tr class="subtotal-row"><td colspan="4" class="td-right td-light">Remise</td><td class="td-right td-red">- ${formatPrice(remiseTotal)}</td></tr>` : ''}
    <tr class="total-row">
      <td colspan="4" class="td-right td-total-label">TOTAL À PAYER</td>
      <td class="td-right td-total-val">${formatPrice(totalFinal)}</td>
    </tr>
    ${inv.estCredit && !inv.creditRegle ? `
    <tr class="subtotal-row"><td colspan="4" class="td-right" style="color:#0e9f6e">Versé</td><td class="td-right" style="color:#0e9f6e;font-weight:700">${formatPrice(inv.montantVerse || 0)}</td></tr>
    <tr class="subtotal-row"><td colspan="4" class="td-right" style="color:#d97706">Reste à payer</td><td class="td-right" style="color:#d97706;font-weight:800">${formatPrice(inv.montantRestant || 0)}</td></tr>
    ` : ''}`;

  // Couleurs selon design
  const acc      = design === 2 ? '#f59e0b' : design === 3 ? '#18181b' : '#1a56db';
  const accLight = design === 2 ? '#fef3c7' : design === 3 ? '#f4f4f5' : '#eff6ff';
  const headerGrad = design === 2
    ? 'background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);'
    : design === 3 ? 'background:#ffffff;border-bottom:3px solid #18181b;'
    : 'background:linear-gradient(135deg,#081648 0%,#0d2b85 50%,#1a56db 100%);';
  const headerTextColor = design === 3 ? '#18181b' : '#ffffff';
  const headerSubColor  = design === 3 ? '#52525b' : design === 2 ? '#94a3b8' : 'rgba(255,255,255,0.60)';
  const logoFallbackBg  = design === 3 ? '#e4e4e7' : 'rgba(255,255,255,0.15)';
  const logoFallbackColor = design === 3 ? '#18181b' : '#ffffff';
  const numColor = design === 2 ? '#fbbf24' : design === 3 ? '#52525b' : '#93c5fd';
  const footerGrad = design === 2
    ? 'background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);'
    : design === 3 ? 'background:#18181b;'
    : 'background:linear-gradient(135deg,#081648 0%,#0d2b85 100%);';
  const tblHead = design === 2 ? 'background:linear-gradient(135deg,#0f172a,#1e293b);'
    : design === 3 ? 'background:#18181b;'
    : 'background:linear-gradient(135deg,#081648,#1a56db);';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Facture ${inv.numero} — ${nom}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#f8fafc;padding:20px;font-size:12px;line-height:1.5}
    .invoice-sheet{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(8,22,72,.10);max-width:760px;margin:0 auto;overflow:hidden}
    .inv-header{${headerGrad}padding:24px 28px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
    .inv-brand{display:flex;align-items:center;gap:12px}
    .inv-logo-img{width:64px;height:64px;object-fit:contain;border-radius:10px;border:1.5px solid rgba(128,128,128,.3)}
    .inv-logo-fallback{width:56px;height:56px;border-radius:14px;background:${logoFallbackBg};border:2px solid rgba(128,128,128,.25);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:${logoFallbackColor};flex-shrink:0}
    .inv-brand-text{color:${headerTextColor}}
    .inv-brand-name{font-size:20px;font-weight:900;letter-spacing:.5px;margin-bottom:3px}
    .inv-brand-sub{font-size:11px;color:${headerSubColor};letter-spacing:.4px}
    .inv-brand-contact{margin-top:6px;font-size:11px;color:${headerSubColor};line-height:1.7}
    .inv-title-block{text-align:right;color:${headerTextColor}}
    .inv-title{font-size:24px;font-weight:900;letter-spacing:-.5px;text-transform:uppercase;opacity:.9}
    .inv-number{font-size:15px;font-weight:700;color:${numColor};margin-top:4px;letter-spacing:.5px}
    .inv-date{font-size:11px;color:${headerSubColor};margin-top:4px}
    .inv-info{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #f1f5f9}
    .inv-info-block{padding:16px 28px;border-right:1px solid #f1f5f9}
    .inv-info-block:last-child{border-right:none}
    .inv-info-label{font-size:9px;font-weight:800;color:${acc};text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
    .inv-info-name{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:3px}
    .inv-info-detail{font-size:11.5px;color:#64748b;line-height:1.7}
    table{width:100%;border-collapse:collapse}
    thead tr{${tblHead}color:#fff}
    thead th{padding:10px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px}
    .th-right{text-align:right}.th-center{text-align:center}
    tbody tr.even{background:#f8fafc}
    td{padding:9px 14px;font-size:12px;border-bottom:1px solid #f1f5f9}
    .td-name{font-weight:600;color:#0f172a}.td-center{text-align:center;color:#475569}
    .td-right{text-align:right;color:#475569}.td-bold{font-weight:700;color:#0f172a}
    .td-remise{color:#dc2626;font-weight:600}.td-light{color:#64748b;font-size:11px}.td-red{color:#dc2626;font-weight:700}
    .subtotal-row td{border-bottom:none;padding:5px 14px}
    .total-row{background:${accLight}}
    .total-row td{padding:12px 14px;border-top:2px solid ${acc}}
    .td-total-label{font-size:12px;font-weight:700;color:${acc};text-transform:uppercase;letter-spacing:.5px}
    .td-total-val{font-size:18px;font-weight:900;color:${acc}}
    .inv-footer{${footerGrad}padding:14px 28px;display:flex;align-items:center;justify-content:space-between;gap:12px}
    .inv-footer-shop-name{font-weight:800;font-size:13px;color:#fff}
    .inv-footer-sub{font-size:11px;color:rgba(255,255,255,.65)}
    .inv-footer-thank{font-size:11px;color:rgba(255,255,255,.60);font-style:italic}
    @media print{@page{size:A4;margin:8mm}body{background:white;padding:0}.invoice-sheet{box-shadow:none;border-radius:0;max-width:100%}}
  </style>
</head>
<body>
<div class="invoice-sheet">
  <div class="inv-header">
    <div class="inv-brand">
      <div>${logoBlock}</div>
      <div class="inv-brand-text">
        <p class="inv-brand-name">${nom}</p>
        <p class="inv-brand-sub">${ville || 'Gestion de boutique'}</p>
        <div class="inv-brand-contact">
          ${adr ? `📍 ${adr}${ville ? ', ' + ville : ''}<br>` : ''}
          ${tel ? `📞 ${tel}<br>` : ''}
          ${email ? `✉ ${email}<br>` : ''}
          ${rc ? `RC: ${rc}` : ''}${rc && ifu ? ' · ' : ''}${ifu ? `IFU: ${ifu}` : ''}
        </div>
      </div>
    </div>
    <div class="inv-title-block">
      <p class="inv-title">Facture</p>
      <p class="inv-number">${inv.numero}</p>
      <p class="inv-date">Émise le ${formatDate(inv.date)}</p>
      ${inv.vendeurNom ? `<p class="inv-date">Vendeur : ${inv.vendeurNom}</p>` : ''}
      ${inv.estCredit ? `<div style="margin-top:8px;padding:7px 12px;background:rgba(217,119,6,.15);border:1px solid rgba(217,119,6,.4);border-radius:7px;color:${headerTextColor}">
        <div style="font-size:9px;font-weight:800;color:${numColor};margin-bottom:3px">VENTE À CRÉDIT</div>
        <div style="font-size:11px;opacity:.85">Mode : ${getModePaiementLabel(inv.modePaiement)}</div>
        ${inv.dateEcheance ? `<div style="font-size:11px;opacity:.85">Échéance : ${formatDate(inv.dateEcheance)}</div>` : ''}
        <div style="font-size:11px;font-weight:700;margin-top:2px">${inv.creditRegle ? '✓ Réglé' : 'En cours'}</div>
      </div>` : ''}
    </div>
  </div>

  <div class="inv-info">
    <div class="inv-info-block">
      <p class="inv-info-label">Facturé à</p>
      <p class="inv-info-name">${inv.clientNom || 'Client divers'} ${inv.clientPrenom || ''}</p>
      <div class="inv-info-detail">
        ${inv.clientTelephone ? `📞 ${inv.clientTelephone}<br>` : ''}
        ${inv.clientAdresse ? `📍 ${inv.clientAdresse}<br>` : ''}
        ${!inv.clientTelephone && !inv.clientAdresse ? 'Aucune coordonnée' : ''}
      </div>
    </div>
    <div class="inv-info-block">
      <p class="inv-info-label">Détails</p>
      <div class="inv-info-detail">
        <strong>N° :</strong> ${inv.numero}<br>
        <strong>Date :</strong> ${formatDate(inv.date)}<br>
        <strong>Mode :</strong> ${getModePaiementLabel(inv.modePaiement)}<br>
        ${inv.referencePaiement ? `<strong>Réf :</strong> ${inv.referencePaiement}<br>` : ''}
        ${inv.notes ? `<strong>Notes :</strong> ${inv.notes}` : ''}
      </div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th>Désignation</th>
      <th class="th-center">Qté</th>
      <th class="th-right">Prix unit.</th>
      <th class="th-center">Remise</th>
      <th class="th-right">Sous-total</th>
    </tr></thead>
    <tbody>${rows}${totauxRows}</tbody>
  </table>

  <div class="inv-footer">
    <div>
      <p class="inv-footer-shop-name">${nom}</p>
      ${adr || tel ? `<p class="inv-footer-sub">${adr}${ville ? ', ' + ville : ''}${tel ? ' — ' + tel : ''}</p>` : ''}
    </div>
    <p class="inv-footer-thank">Merci pour votre confiance !</p>
  </div>
</div>
</body>
</html>`;
}

export async function imprimerFactureRN(inv: InvoiceData, shop: ShopInfo, design: DesignFacture = 1): Promise<void> {
  const html = buildInvoiceHtml(inv, shop, design);
  await Print.printAsync({ html });
}

export async function partagerFactureRN(inv: InvoiceData, shop: ShopInfo, design: DesignFacture = 1): Promise<void> {
  const html = buildInvoiceHtml(inv, shop, design);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Facture ${inv.numero}`, UTI: 'com.adobe.pdf' });
}

// ─── Reçus paiement fournisseur & règlement crédit ───────────────────────────

export function buildRecuPaiementFournisseurHtml(
  paiement: { id?: number; datePaiement?: string; montant: number; modePaiement?: string; reference?: string; observation?: string },
  fournisseur: { nom: string; code?: string; telephone?: string },
  shop: ShopInfo,
  design: DesignFacture = 1
): string {
  const nomBoutique = shop.nom || 'Ges Boutique';
  const date = paiement.datePaiement
    ? new Date(paiement.datePaiement).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');
  const numero = paiement.id ? `PAI-${paiement.id}` : 'PAI-XXX';
  const qrData = encodeURIComponent(
    `RECU PAIEMENT FOURNISSEUR\nFournisseur: ${fournisseur.nom}\nDate: ${date}\nMontant: ${formatPrice(paiement.montant)}\nMode: ${paiement.modePaiement || 'ESPECES'}\nRef: ${paiement.reference || '-'}\nBoutique: ${nomBoutique}`
  );
  const rows: [string, string][] = [
    ['Mode de paiement', paiement.modePaiement || 'ESPECES'],
    ...(paiement.reference ? [['Référence', paiement.reference] as [string, string]] : []),
    ...(paiement.observation ? [['Observation', paiement.observation] as [string, string]] : []),
  ];
  return buildRecuHtml({
    type: 'PAIEMENT FOURNISSEUR', numero, date,
    entite: fournisseur.nom + (fournisseur.code ? ` (${fournisseur.code})` : ''),
    entiteLabel: 'Fournisseur', telephone: fournisseur.telephone,
    rows, montant: paiement.montant, montantLabel: 'MONTANT PAYE',
    boutique: nomBoutique, tel: shop.telephone || '', adr: shop.adresse || '', qrData, design,
  });
}

export function buildRecuReglementCreditHtml(
  reglement: { id?: number; montant: number; modePaiement?: string; datePaiement?: string; montantRestant?: number },
  client: { nom: string; prenom?: string; telephone?: string },
  shop: ShopInfo,
  design: DesignFacture = 1
): string {
  const nomBoutique = shop.nom || 'Ges Boutique';
  const date = reglement.datePaiement
    ? new Date(reglement.datePaiement).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');
  const clientNom = [client.prenom, client.nom].filter(Boolean).join(' ') || client.nom;
  const numero = reglement.id ? `REG-${reglement.id}` : 'REG-XXX';
  const qrData = encodeURIComponent(
    `RECU REGLEMENT CREDIT\nClient: ${clientNom}\nDate: ${date}\nMontant: ${formatPrice(reglement.montant)}\nMode: ${reglement.modePaiement || 'ESPECES'}\nBoutique: ${nomBoutique}`
  );
  const rows: [string, string][] = [
    ['Mode de paiement', reglement.modePaiement || 'ESPECES'],
    ...(reglement.montantRestant != null ? [['Reste du', formatPrice(reglement.montantRestant)] as [string, string]] : []),
  ];
  return buildRecuHtml({
    type: 'REGLEMENT CREDIT', numero, date, entite: clientNom, entiteLabel: 'Client',
    telephone: client.telephone, rows, montant: reglement.montant, montantLabel: 'MONTANT REGLE',
    boutique: nomBoutique, tel: shop.telephone || '', adr: shop.adresse || '', qrData, design,
  });
}

function buildRecuHtml(c: {
  type: string; numero: string; date: string; entite: string; entiteLabel: string;
  telephone?: string; rows: [string, string][]; montant: number; montantLabel: string;
  boutique: string; tel: string; adr: string; qrData: string; design: DesignFacture;
}): string {
  const acc = c.design === 2 ? '#f59e0b' : c.design === 3 ? '#18181b' : '#1a56db';
  const hdrGrad = c.design === 2
    ? 'linear-gradient(135deg,#0f172a,#1e293b)'
    : c.design === 3 ? '#18181b'
    : 'linear-gradient(135deg,#081648,#1a56db)';
  const rowsHtml = c.rows.map(([l, v]) =>
    `<div class="r"><span class="rl">${l}</span><span class="rv">${v}</span></div>`
  ).join('');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${c.type} - ${c.numero}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;padding:24px;font-size:13px}
.sheet{background:#fff;max-width:520px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(8,22,72,.12)}
.hdr{background:${hdrGrad};color:#fff;padding:28px 24px;text-align:center}
.hdr-type{font-size:11px;letter-spacing:3px;opacity:.7;text-transform:uppercase;margin-bottom:6px}
.hdr-title{font-size:24px;font-weight:900;letter-spacing:1px}
.hdr-num{font-size:12px;opacity:.65;margin-top:6px}
.body{padding:24px}
.section{margin-bottom:18px}
.section-title{font-size:10px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin-bottom:8px}
.entity{font-size:17px;font-weight:700;color:#1e293b}
.entity-sub{font-size:12px;color:#64748b;margin-top:2px}
.r{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f1f5f9}
.rl{color:#64748b;font-size:12px}.rv{font-weight:600;color:#1e293b;font-size:12px}
.total-box{background:#eff6ff;border:2px solid ${acc};border-radius:10px;padding:18px;text-align:center;margin:18px 0}
.total-lbl{font-size:11px;letter-spacing:2px;color:${acc};text-transform:uppercase;margin-bottom:6px}
.total-val{font-size:32px;font-weight:900;color:${acc}}
.qr-block{text-align:center;padding:12px 0}
.qr-block img{border-radius:8px;border:3px solid #e2e8f0}
.qr-hint{font-size:10px;color:#94a3b8;margin-top:6px}
.ftr{background:${hdrGrad};color:rgba(255,255,255,.6);text-align:center;padding:14px;font-size:11px}
@media print{@page{size:A5;margin:6mm}body{background:white;padding:0}.sheet{box-shadow:none;border-radius:0;max-width:100%}}
</style></head><body>
<div class="sheet">
  <div class="hdr">
    <div class="hdr-type">${c.boutique}</div>
    <div class="hdr-title">RECU</div>
    <div class="hdr-num">${c.type} · ${c.numero} · ${c.date}</div>
  </div>
  <div class="body">
    <div class="section">
      <div class="section-title">${c.entiteLabel}</div>
      <div class="entity">${c.entite}</div>
      ${c.telephone ? `<div class="entity-sub">${c.telephone}</div>` : ''}
    </div>
    <div class="section">
      <div class="section-title">Details</div>
      ${rowsHtml}
    </div>
    <div class="total-box">
      <div class="total-lbl">${c.montantLabel}</div>
      <div class="total-val">${formatPrice(c.montant)}</div>
    </div>
    <div class="qr-block">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${c.qrData}" width="110" height="110" alt="QR" onerror="this.style.display='none'">
      <div class="qr-hint">Scanner pour verifier ce recu</div>
    </div>
    ${c.adr || c.tel ? `<div style="text-align:center;color:#94a3b8;font-size:11px">${[c.boutique, c.adr, c.tel].filter(Boolean).join(' - ')}</div>` : ''}
  </div>
  <div class="ftr">Document officiel - Ges Boutique - Genere le ${new Date().toLocaleDateString('fr-FR')}</div>
</div>
</body></html>`;
}
