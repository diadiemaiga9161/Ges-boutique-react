import React, { useEffect, useState } from 'react';
import {
  View, FlatList, StyleSheet, Alert, RefreshControl,
  ScrollView, TouchableOpacity,
} from 'react-native';
import {
  Text, Card, FAB, Searchbar, ActivityIndicator, Modal, Portal,
  TextInput, Button,
} from 'react-native-paper';
import * as Print from 'expo-print';
import {
  getFournisseurs, createFournisseur,
  getHistoriqueAchatsFournisseur, getHistoriquePaiementsFournisseur,
  getSituationFournisseur, creerAchatFournisseur, payerFournisseur,
  getProduits, annulerAchatFournisseur,
  getAvancesFournisseur, creerAvanceFournisseur,
} from '../services/api.service';
import { buildRecuPaiementFournisseurHtml } from '../services/invoice.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

const MODES_PAIEMENT = ['ESPECES', 'VIREMENT', 'CHEQUE'];
const STATUT_COLOR: Record<string, string> = {
  PAYE: '#16a34a', EN_COURS: '#d97706', IMPAYE: '#dc2626', ANNULE: '#6b7280',
};

function money(v: number) { return (v || 0).toLocaleString('fr-FR') + ' FCFA'; }
function fdate(d?: string) { if (!d) return '—'; return new Date(d).toLocaleDateString('fr-FR'); }

function buildFicheFournisseurHtml(fournisseur: any, achats: any[], paiements: any[], situation: any) {
  const achatsActifs = achats.filter(a => a.statut !== 'ANNULE');
  const achatsHtml = achatsActifs.map(a => {
    const lignesStr = (a.lignes || []).map((l: any) => `${l.produit?.nom || '?'} ×${l.quantite}`).join(', ');
    const statColor = a.statut === 'PAYE' ? '#16a34a' : '#d97706';
    return `<tr>
      <td>${a.dateAchat ? new Date(a.dateAchat).toLocaleDateString('fr-FR') : '—'}</td>
      <td style="font-size:11px;color:#475569">${lignesStr || '—'}</td>
      <td style="text-align:right">${(a.montantTotal || 0).toLocaleString('fr-FR')} FCFA</td>
      <td style="text-align:right;color:#16a34a">${(a.montantPaye || 0).toLocaleString('fr-FR')} FCFA</td>
      <td><span style="background:${statColor}22;color:${statColor};padding:2px 8px;border-radius:10px;font-size:10px">${a.statut}</span></td>
    </tr>`;
  }).join('');

  const paiementsHtml = paiements.map(p => `<tr>
    <td>${p.datePaiement ? new Date(p.datePaiement).toLocaleDateString('fr-FR') : '—'}</td>
    <td>${p.modePaiement || '—'}</td>
    <td style="text-align:right;font-weight:700;color:#16a34a">${(p.montant || 0).toLocaleString('fr-FR')} FCFA</td>
    <td>${p.reference || '—'}</td>
  </tr>`).join('');

  const solde = situation?.solde ?? situation?.resteAPayer ?? 0;
  const totalAchats = situation?.totalAchats ?? situation?.totalAchat ?? 0;
  const totalPaye = situation?.totalPaye ?? situation?.montantPaye ?? 0;
  const qrData = encodeURIComponent(`FICHE FOURNISSEUR\nNom: ${fournisseur.nom}\nTotal achats: ${totalAchats} FCFA\nTotal payé: ${totalPaye} FCFA\nSolde dû: ${solde} FCFA`);

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Fiche Fournisseur — ${fournisseur.nom}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;padding:20px;font-size:12px}
.sheet{background:#fff;max-width:800px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(8,22,72,.1)}
.hdr{background:linear-gradient(135deg,#081648,#1a56db);color:#fff;padding:24px 28px;display:flex;justify-content:space-between;align-items:center}
.hdr-title{font-size:22px;font-weight:900}.hdr-sub{font-size:12px;opacity:.7;margin-top:4px}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid #e5e7eb}
.kpi{padding:16px 20px;text-align:center;border-right:1px solid #e5e7eb}
.kpi:last-child{border-right:none}
.kpi-val{font-size:20px;font-weight:900;color:#1a56db}.kpi-lbl{font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:1px}
.section{padding:20px 24px}.section-title{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #1a56db}
table{width:100%;border-collapse:collapse}
th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:2px solid #e5e7eb}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px}
tr:nth-child(even){background:#fafafa}
.ftr{background:#f8fafc;text-align:center;padding:14px;font-size:10px;color:#94a3b8;border-top:1px solid #e5e7eb}
</style></head><body>
<div class="sheet">
  <div class="hdr">
    <div>
      <div class="hdr-title">${fournisseur.nom}${fournisseur.code ? ` (${fournisseur.code})` : ''}</div>
      <div class="hdr-sub">Fiche fournisseur · ${new Date().toLocaleDateString('fr-FR')}</div>
      ${fournisseur.telephone ? `<div class="hdr-sub">Tel: ${fournisseur.telephone}</div>` : ''}
    </div>
    <div style="text-align:center">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${qrData}" width="80" height="80" style="border-radius:6px;background:#fff;padding:3px" onerror="this.style.display='none'">
    </div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-val">${totalAchats.toLocaleString('fr-FR')} FCFA</div><div class="kpi-lbl">Total achats</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#16a34a">${totalPaye.toLocaleString('fr-FR')} FCFA</div><div class="kpi-lbl">Total payé</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#dc2626">${solde.toLocaleString('fr-FR')} FCFA</div><div class="kpi-lbl">Solde dû</div></div>
  </div>
  <div class="section">
    <div class="section-title">Historique des achats</div>
    <table><thead><tr><th>Date</th><th>Produits</th><th>Total</th><th>Payé</th><th>Statut</th></tr></thead>
    <tbody>${achatsHtml || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">Aucun achat</td></tr>'}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Paiements effectués</div>
    <table><thead><tr><th>Date</th><th>Mode</th><th>Montant</th><th>Référence</th></tr></thead>
    <tbody>${paiementsHtml || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">Aucun paiement</td></tr>'}</tbody></table>
  </div>
  <div class="ftr">Ges Boutique · Document généré le ${new Date().toLocaleDateString('fr-FR')}</div>
</div>
</body></html>`;
}

export default function FournisseursScreen() {
  const { lang } = useLang();

  const [mode, setMode] = useState<'list' | 'detail'>('list');
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [tab, setTab] = useState<'achats' | 'paiements' | 'situation' | 'avances'>('achats');
  const [achats, setAchats] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [situation, setSituation] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedAchat, setExpandedAchat] = useState<number | null>(null);

  // Avances
  const [avances, setAvances] = useState<any[]>([]);
  const [soldeAvance, setSoldeAvance] = useState(0);
  const [showAvanceModal, setShowAvanceModal] = useState(false);
  const [avanceForm, setAvanceForm] = useState({ montant: '', motif: '' });

  const [showFournModal, setShowFournModal] = useState(false);
  const [showAchatModal, setShowAchatModal] = useState(false);
  const [showPaiementModal, setShowPaiementModal] = useState(false);

  const [fournForm, setFournForm] = useState({ nom: '', code: '', telephone: '', email: '', adresse: '' });
  const [achatForm, setAchatForm] = useState({ produitId: 0, produitNom: '', quantite: '1', prixAchatUnitaire: '', prixVente: '', montantPaye: '0', commentaire: '' });
  const [paiForm, setPaiForm] = useState({ montant: '', modePaiement: 'ESPECES', reference: '', observation: '' });
  const [produits, setProduits] = useState<any[]>([]);
  const [showProduitPicker, setShowProduitPicker] = useState(false);

  const charger = async () => {
    try {
      const res = await getFournisseurs();
      const data = res.data?.data || res.data || [];
      setFournisseurs(data); setFiltered(data);
    } catch {}
    setLoading(false); setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);
  useEffect(() => {
    if (!search) { setFiltered(fournisseurs); return; }
    setFiltered(fournisseurs.filter((f: any) =>
      f.nom?.toLowerCase().includes(search.toLowerCase()) ||
      f.code?.toLowerCase().includes(search.toLowerCase()),
    ));
  }, [search, fournisseurs]);

  const chargerDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const [ra, rp, rs, rv] = await Promise.all([
        getHistoriqueAchatsFournisseur(id),
        getHistoriquePaiementsFournisseur(id),
        getSituationFournisseur(id),
        getAvancesFournisseur(id),
      ]);
      setAchats(ra.data?.achats || []);
      setPaiements(rp.data?.paiements || []);
      setSituation(rs.data?.data || rs.data);
      const avancesData: any[] = rv.data?.avances || rv.data || [];
      setAvances(avancesData);
      setSoldeAvance(avancesData.reduce((s: number, a: any) => s + (a.montant || 0), 0));
    } catch {}
    setLoadingDetail(false);
  };

  const selectionner = (f: any) => {
    setSelected(f); setTab('achats'); setMode('detail');
    chargerDetail(f.id);
  };

  const retourListe = () => {
    setMode('list'); setSelected(null);
    setAchats([]); setPaiements([]); setSituation(null);
    setAvances([]); setSoldeAvance(0);
  };

  const ajouterFournisseur = async () => {
    if (!fournForm.nom || !fournForm.code) { Alert.alert(tr('erreur', lang), 'Nom et code obligatoires'); return; }
    try {
      await createFournisseur(fournForm);
      setShowFournModal(false);
      setFournForm({ nom: '', code: '', telephone: '', email: '', adresse: '' });
      charger();
    } catch { Alert.alert(tr('erreur', lang), 'Impossible d\'ajouter le fournisseur'); }
  };

  const ouvrirAchat = async () => {
    try {
      const res = await getProduits();
      const data = res.data?.data || res.data?.produits || res.data || [];
      setProduits(data);
    } catch {}
    setAchatForm({ produitId: 0, produitNom: '', quantite: '1', prixAchatUnitaire: '', prixVente: '', montantPaye: '0', commentaire: '' });
    setShowProduitPicker(false);
    setShowAchatModal(true);
  };

  const enregistrerAchat = async () => {
    if (!achatForm.produitId) { Alert.alert(tr('erreur', lang), 'Sélectionnez un produit'); return; }
    if (!achatForm.quantite || !achatForm.prixAchatUnitaire) { Alert.alert(tr('erreur', lang), 'Quantité et prix obligatoires'); return; }
    try {
      await creerAchatFournisseur({
        fournisseurId: selected.id,
        lignes: [{
          produitId: achatForm.produitId,
          quantite: parseFloat(achatForm.quantite),
          prixAchatUnitaire: parseFloat(achatForm.prixAchatUnitaire),
          prixVente: parseFloat(achatForm.prixVente || '0'),
        }],
        montantPaye: parseFloat(achatForm.montantPaye || '0'),
        commentaire: achatForm.commentaire,
      });
      setShowAchatModal(false);
      chargerDetail(selected.id);
    } catch { Alert.alert(tr('erreur', lang), 'Impossible d\'enregistrer l\'achat'); }
  };

  const enregistrerPaiement = async () => {
    if (!paiForm.montant) { Alert.alert(tr('erreur', lang), 'Montant obligatoire'); return; }
    try {
      await payerFournisseur({
        fournisseurId: selected.id,
        montant: parseFloat(paiForm.montant),
        modePaiement: paiForm.modePaiement,
        reference: paiForm.reference,
        observation: paiForm.observation,
      });
      setShowPaiementModal(false);
      chargerDetail(selected.id);
    } catch { Alert.alert(tr('erreur', lang), 'Impossible d\'enregistrer le paiement'); }
  };

  const confirmerAnnulerAchat = (achat: any) => {
    Alert.alert(
      tr('annuler', lang) + ' ?',
      `${tr('achat', lang)} du ${fdate(achat.dateAchat)} — ${money(achat.montantTotal)}\nCette action est irréversible.`,
      [
        { text: tr('fermer', lang), style: 'cancel' },
        {
          text: tr('annuler', lang),
          style: 'destructive',
          onPress: async () => {
            try {
              await annulerAchatFournisseur(achat.id);
              chargerDetail(selected.id);
            } catch {
              Alert.alert(tr('erreur', lang), 'Impossible d\'annuler cet achat');
            }
          },
        },
      ],
    );
  };

  const enregistrerAvance = async () => {
    if (!avanceForm.montant || isNaN(Number(avanceForm.montant)) || Number(avanceForm.montant) <= 0) {
      Alert.alert(tr('erreur', lang), 'Montant invalide'); return;
    }
    try {
      await creerAvanceFournisseur({
        fournisseurId: selected.id,
        montant: parseFloat(avanceForm.montant),
        motif: avanceForm.motif,
      });
      setShowAvanceModal(false);
      setAvanceForm({ montant: '', motif: '' });
      chargerDetail(selected.id);
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible d\'enregistrer l\'avance');
    }
  };

  const genererFichePdf = async () => {
    try {
      const html = buildFicheFournisseurHtml(selected, achats, paiements, situation);
      await Print.printAsync({ html });
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible de générer la fiche PDF');
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  // ──── VUE DÉTAIL FOURNISSEUR ────
  if (mode === 'detail' && selected) {
    const achatsActifs = achats.filter(a => a.statut !== 'ANNULE');
    const achatsAnnules = achats.filter(a => a.statut === 'ANNULE');

    return (
      <View style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={retourListe} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailNom}>{selected.nom}</Text>
            {selected.code ? <Text style={styles.detailCode}>{selected.code}</Text> : null}
          </View>
          <TouchableOpacity onPress={genererFichePdf} style={styles.ficheBtn}>
            <Text style={styles.ficheBtnText}>Fiche PDF</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          {(['achats', 'paiements', 'situation', 'avances'] as const).map(t => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'achats' ? tr('achat', lang) : t === 'paiements' ? 'Paiements' : t === 'situation' ? 'Situation' : 'Avances'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loadingDetail ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 80 }}>
            {/* ── ACHATS ── */}
            {tab === 'achats' && (
              achats.length === 0
                ? <Text style={styles.empty}>Aucun achat trouvé</Text>
                : (
                  <>
                    {/* Achats actifs */}
                    {achatsActifs.map((a: any) => (
                      <Card key={a.id} style={styles.card}>
                        <TouchableOpacity onPress={() => setExpandedAchat(expandedAchat === a.id ? null : a.id)}>
                          <Card.Content>
                            <View style={styles.row}>
                              <Text style={styles.achatDate}>{fdate(a.dateAchat)}</Text>
                              <Text style={[styles.statutBadge, { backgroundColor: STATUT_COLOR[a.statut] || '#6b7280' }]}>
                                {a.statut}
                              </Text>
                            </View>
                            <View style={[styles.row, { marginTop: 6 }]}>
                              <Text style={styles.moneyLabel}>Total</Text>
                              <Text style={styles.moneyVal}>{money(a.montantTotal)}</Text>
                            </View>
                            <View style={styles.row}>
                              <Text style={styles.moneyLabel}>Payé</Text>
                              <Text style={[styles.moneyVal, { color: '#16a34a' }]}>{money(a.montantPaye)}</Text>
                            </View>
                            {a.montantRestant > 0 && (
                              <View style={styles.row}>
                                <Text style={styles.moneyLabel}>Restant</Text>
                                <Text style={[styles.moneyVal, { color: '#dc2626' }]}>{money(a.montantRestant)}</Text>
                              </View>
                            )}
                            {a.commentaire ? <Text style={styles.sub}>{a.commentaire}</Text> : null}
                            {a.lignes?.length > 0 && (
                              <Text style={styles.expandHint}>{expandedAchat === a.id ? 'Masquer lignes' : `${a.lignes.length} produit(s) — appuyer pour voir`}</Text>
                            )}
                            <TouchableOpacity
                              style={styles.annulerBtn}
                              onPress={() => confirmerAnnulerAchat(a)}
                            >
                              <Text style={styles.annulerBtnText}>Annuler</Text>
                            </TouchableOpacity>
                          </Card.Content>
                        </TouchableOpacity>
                        {expandedAchat === a.id && a.lignes?.length > 0 && (
                          <Card.Content style={styles.lignes}>
                            {a.lignes.map((l: any, i: number) => (
                              <View key={i} style={styles.ligneRow}>
                                <Text style={styles.ligneProduit} numberOfLines={1}>{l.produit?.nom || '—'}</Text>
                                <Text style={styles.ligneQty}>{l.quantite} × {money(l.prixAchatUnitaire)}</Text>
                                <Text style={styles.ligneSous}>{money(l.sousTotal)}</Text>
                              </View>
                            ))}
                          </Card.Content>
                        )}
                      </Card>
                    ))}

                    {/* Achats annulés */}
                    {achatsAnnules.length > 0 && (
                      <>
                        <View style={styles.separateurAnnules}>
                          <View style={styles.separateurLine} />
                          <Text style={styles.separateurLabel}>Achats annulés ({achatsAnnules.length})</Text>
                          <View style={styles.separateurLine} />
                        </View>
                        {achatsAnnules.map((a: any) => (
                          <Card key={a.id} style={styles.cardAnnule}>
                            <Card.Content>
                              <View style={styles.row}>
                                <Text style={[styles.achatDate, styles.textAnnule]}>{fdate(a.dateAchat)}</Text>
                                <Text style={[styles.statutBadge, { backgroundColor: '#6b7280' }]}>
                                  ANNULE
                                </Text>
                              </View>
                              <View style={[styles.row, { marginTop: 6 }]}>
                                <Text style={[styles.moneyLabel, styles.textAnnule]}>Total</Text>
                                <Text style={[styles.moneyVal, styles.textAnnule, styles.textBarre]}>{money(a.montantTotal)}</Text>
                              </View>
                              {a.commentaire ? <Text style={[styles.sub, styles.textAnnule]}>{a.commentaire}</Text> : null}
                            </Card.Content>
                          </Card>
                        ))}
                      </>
                    )}
                  </>
                )
            )}

            {/* ── PAIEMENTS ── */}
            {tab === 'paiements' && (
              paiements.length === 0
                ? <Text style={styles.empty}>Aucun paiement trouvé</Text>
                : paiements.map((p: any, i: number) => (
                  <Card key={p.id ?? i} style={styles.card}>
                    <Card.Content>
                      <View style={styles.row}>
                        <Text style={styles.achatDate}>{fdate(p.datePaiement)}</Text>
                        <Text style={styles.modeBadge}>{p.modePaiement}</Text>
                      </View>
                      <Text style={[styles.moneyVal, { fontSize: 18, marginTop: 4 }]}>{money(p.montant)}</Text>
                      {p.reference ? <Text style={styles.sub}>Réf : {p.reference}</Text> : null}
                      {p.observation ? <Text style={styles.sub}>{p.observation}</Text> : null}
                      <TouchableOpacity
                        style={styles.recuBtn}
                        onPress={async () => {
                          try {
                            const html = buildRecuPaiementFournisseurHtml(p, selected, { nom: selected?.nom || 'Ges Boutique', telephone: selected?.telephone });
                            await Print.printAsync({ html });
                          } catch { Alert.alert(tr('erreur', lang), 'Impossible de générer le reçu'); }
                        }}
                      >
                        <Text style={styles.recuBtnText}>Recu PDF</Text>
                      </TouchableOpacity>
                    </Card.Content>
                  </Card>
                ))
            )}

            {/* ── SITUATION ── */}
            {tab === 'situation' && situation && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={styles.sitTitle}>Situation financière</Text>
                  <View style={styles.sitRow}>
                    <Text style={styles.sitLabel}>Total achats</Text>
                    <Text style={styles.sitVal}>{money(situation.totalAchats ?? situation.totalAchat ?? 0)}</Text>
                  </View>
                  <View style={styles.sitRow}>
                    <Text style={styles.sitLabel}>Total payé</Text>
                    <Text style={[styles.sitVal, { color: '#16a34a' }]}>{money(situation.totalPaye ?? situation.montantPaye ?? 0)}</Text>
                  </View>
                  <View style={[styles.sitRow, { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8, paddingTop: 8 }]}>
                    <Text style={[styles.sitLabel, { fontWeight: 'bold' }]}>Solde dû</Text>
                    <Text style={[styles.sitVal, { color: '#dc2626', fontWeight: 'bold', fontSize: 18 }]}>
                      {money(situation.solde ?? situation.resteAPayer ?? 0)}
                    </Text>
                  </View>
                  {situation.nombreAchats != null && (
                    <Text style={[styles.sub, { marginTop: 8 }]}>{situation.nombreAchats} achat(s) enregistré(s)</Text>
                  )}
                </Card.Content>
              </Card>
            )}
            {tab === 'situation' && !situation && (
              <Text style={styles.empty}>Situation non disponible</Text>
            )}

            {/* ── AVANCES ── */}
            {tab === 'avances' && (
              <>
                <Card style={[styles.card, { backgroundColor: '#eff6ff', marginBottom: 12 }]}>
                  <Card.Content>
                    <Text style={styles.sitLabel}>Solde total des avances</Text>
                    <Text style={[styles.moneyVal, { fontSize: 20, color: '#1e88e5', marginTop: 4 }]}>
                      {money(soldeAvance)}
                    </Text>
                  </Card.Content>
                </Card>

                {avances.length === 0 ? (
                  <Text style={styles.empty}>Aucune avance enregistree</Text>
                ) : (
                  avances.map((a: any, i: number) => (
                    <Card key={a.id ?? i} style={styles.card}>
                      <Card.Content>
                        <View style={styles.row}>
                          <Text style={styles.achatDate}>
                            {a.dateAvance ? new Date(a.dateAvance).toLocaleDateString('fr-FR') : '—'}
                          </Text>
                          <Text style={[styles.moneyVal, { color: '#1e88e5' }]}>{money(a.montant)}</Text>
                        </View>
                        {a.motif ? <Text style={[styles.sub, { marginTop: 4 }]}>{a.motif}</Text> : null}
                      </Card.Content>
                    </Card>
                  ))
                )}
              </>
            )}
          </ScrollView>
        )}

        {tab === 'achats' && (
          <FAB icon="cart-plus" style={[styles.fab, { backgroundColor: '#1e88e5' }]} onPress={ouvrirAchat} />
        )}
        {tab === 'paiements' && (
          <FAB icon="cash" style={[styles.fab, { backgroundColor: '#16a34a' }]} onPress={() => {
            setPaiForm({ montant: '', modePaiement: 'ESPECES', reference: '', observation: '' });
            setShowPaiementModal(true);
          }} />
        )}
        {tab === 'avances' && (
          <FAB icon="plus" style={[styles.fab, { backgroundColor: '#1e88e5' }]} onPress={() => {
            setAvanceForm({ montant: '', motif: '' });
            setShowAvanceModal(true);
          }} />
        )}

        {/* Modal Achat */}
        <Portal>
          <Modal visible={showAchatModal} onDismiss={() => setShowAchatModal(false)} contentContainerStyle={styles.modal}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text variant="titleLarge" style={{ marginBottom: 16 }}>{tr('ajouter', lang)} {tr('achat', lang).toLowerCase()}</Text>

              <TouchableOpacity style={styles.picker} onPress={() => setShowProduitPicker(v => !v)}>
                <Text style={achatForm.produitNom ? styles.pickerVal : styles.pickerPh}>
                  {achatForm.produitNom || 'Sélectionner un produit *'}
                </Text>
                <Text style={{ color: '#94a3b8' }}>{showProduitPicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showProduitPicker && (
                <View style={styles.pickerList}>
                  {produits.map((p: any) => (
                    <TouchableOpacity key={p.id} style={styles.pickerItem} onPress={() => {
                      setAchatForm({ ...achatForm, produitId: p.id, produitNom: p.nom, prixAchatUnitaire: String(p.prixAchat || ''), prixVente: String(p.prixVente || '') });
                      setShowProduitPicker(false);
                    }}>
                      <Text style={[styles.pickerItemText, achatForm.produitId === p.id && { color: '#1e88e5', fontWeight: 'bold' }]}>
                        {p.nom}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TextInput label="Quantité *" value={achatForm.quantite} onChangeText={t => setAchatForm({ ...achatForm, quantite: t })} mode="outlined" keyboardType="numeric" style={styles.input} />
              <TextInput label="Prix achat unitaire *" value={achatForm.prixAchatUnitaire} onChangeText={t => setAchatForm({ ...achatForm, prixAchatUnitaire: t })} mode="outlined" keyboardType="numeric" style={styles.input} />
              <TextInput label="Prix vente" value={achatForm.prixVente} onChangeText={t => setAchatForm({ ...achatForm, prixVente: t })} mode="outlined" keyboardType="numeric" style={styles.input} />
              <TextInput label="Montant payé" value={achatForm.montantPaye} onChangeText={t => setAchatForm({ ...achatForm, montantPaye: t })} mode="outlined" keyboardType="numeric" style={styles.input} />
              <TextInput label="Commentaire" value={achatForm.commentaire} onChangeText={t => setAchatForm({ ...achatForm, commentaire: t })} mode="outlined" style={styles.input} />
              <Button mode="contained" onPress={enregistrerAchat} style={{ marginTop: 4 }}>{tr('enregistrer', lang)}</Button>
            </ScrollView>
          </Modal>
        </Portal>

        {/* Modal Paiement */}
        <Portal>
          <Modal visible={showPaiementModal} onDismiss={() => setShowPaiementModal(false)} contentContainerStyle={styles.modal}>
            <Text variant="titleLarge" style={{ marginBottom: 16 }}>{tr('ajouter', lang)} paiement</Text>
            <TextInput label="Montant *" value={paiForm.montant} onChangeText={t => setPaiForm({ ...paiForm, montant: t })} mode="outlined" keyboardType="numeric" style={styles.input} />
            <Text style={styles.sectionLabel}>Mode de paiement</Text>
            <View style={{ flexDirection: 'row', marginBottom: 12, gap: 6 }}>
              {MODES_PAIEMENT.map(m => (
                <TouchableOpacity key={m} style={[styles.modeBtn, paiForm.modePaiement === m && styles.modeBtnActive]} onPress={() => setPaiForm({ ...paiForm, modePaiement: m })}>
                  <Text style={[styles.modeBtnText, paiForm.modePaiement === m && { color: '#fff' }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput label="Reference" value={paiForm.reference} onChangeText={t => setPaiForm({ ...paiForm, reference: t })} mode="outlined" style={styles.input} />
            <TextInput label="Observation" value={paiForm.observation} onChangeText={t => setPaiForm({ ...paiForm, observation: t })} mode="outlined" style={styles.input} />
            <Button mode="contained" onPress={enregistrerPaiement} style={{ marginTop: 4, backgroundColor: '#16a34a' }}>{tr('enregistrer', lang)}</Button>
          </Modal>
        </Portal>

        {/* Modal Avance */}
        <Portal>
          <Modal visible={showAvanceModal} onDismiss={() => setShowAvanceModal(false)} contentContainerStyle={styles.modal}>
            <Text variant="titleLarge" style={{ marginBottom: 16 }}>{tr('ajouter', lang)} avance</Text>
            <TextInput
              label="Montant *"
              value={avanceForm.montant}
              onChangeText={t => setAvanceForm({ ...avanceForm, montant: t })}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              label="Motif"
              value={avanceForm.motif}
              onChangeText={t => setAvanceForm({ ...avanceForm, motif: t })}
              mode="outlined"
              style={styles.input}
            />
            <Button mode="contained" onPress={enregistrerAvance} style={{ marginTop: 4, backgroundColor: '#1e88e5' }}>
              {tr('enregistrer', lang)}
            </Button>
          </Modal>
        </Portal>
      </View>
    );
  }

  // ──── VUE LISTE ────
  return (
    <View style={styles.container}>
      <Searchbar placeholder={tr('recherche_fournisseur', lang)} value={search} onChangeText={setSearch} style={styles.search} />
      <FlatList
        data={filtered}
        keyExtractor={f => String(f.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => selectionner(item)}>
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.row}>
                  <View style={styles.initiale}>
                    <Text style={styles.initialeText}>{(item.nom || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium">{item.nom}</Text>
                    {item.code && <Text style={styles.sub}>{item.code}</Text>}
                    {item.telephone && <Text style={styles.sub}>{item.telephone}</Text>}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{tr('aucun_resultat', lang)}</Text>}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => setShowFournModal(true)} />
      <Portal>
        <Modal visible={showFournModal} onDismiss={() => setShowFournModal(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleLarge" style={{ marginBottom: 16 }}>{tr('nouveau_fournisseur', lang)}</Text>
          <TextInput label={tr('nom_fournisseur', lang)} value={fournForm.nom} onChangeText={t => setFournForm({ ...fournForm, nom: t })} mode="outlined" style={styles.input} />
          <TextInput label="Code *" value={fournForm.code} onChangeText={t => setFournForm({ ...fournForm, code: t })} mode="outlined" style={styles.input} placeholder="ex: FOUR-001" />
          <TextInput label={tr('telephone', lang)} value={fournForm.telephone} onChangeText={t => setFournForm({ ...fournForm, telephone: t })} mode="outlined" style={styles.input} keyboardType="phone-pad" />
          <TextInput label={tr('email', lang)} value={fournForm.email} onChangeText={t => setFournForm({ ...fournForm, email: t })} mode="outlined" style={styles.input} keyboardType="email-address" />
          <TextInput label={tr('adresse', lang)} value={fournForm.adresse} onChangeText={t => setFournForm({ ...fournForm, adresse: t })} mode="outlined" style={styles.input} />
          <Button mode="contained" onPress={ajouterFournisseur}>{tr('enregistrer', lang)}</Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  search: { margin: 12 },
  card: { marginBottom: 10, borderRadius: 12 },
  cardAnnule: { marginBottom: 10, borderRadius: 12, backgroundColor: '#f3f4f6', opacity: 0.75 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sub: { color: '#666', fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  fab: { position: 'absolute', bottom: 20, right: 20 },
  modal: { backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20, maxHeight: '85%' },
  input: { marginBottom: 12 },
  initiale: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e88e5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  initialeText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  chevron: { color: '#94a3b8', fontSize: 22, fontWeight: 'bold' },
  // Detail
  detailHeader: { backgroundColor: '#1e88e5', flexDirection: 'row', alignItems: 'center', padding: 14, paddingTop: 18 },
  backBtn: { padding: 6, marginRight: 8 },
  backArrow: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  detailNom: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  detailCode: { color: '#bbdefb', fontSize: 13 },
  ficheBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 8, marginLeft: 8 },
  ficheBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: '#1e88e5' },
  tabLabel: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  tabLabelActive: { color: '#1e88e5', fontWeight: 'bold' },
  // Achats
  achatDate: { color: '#475569', fontSize: 13, fontWeight: '500' },
  statutBadge: { color: '#fff', fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  modeBadge: { backgroundColor: '#eff6ff', color: '#1e40af', fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  moneyLabel: { color: '#6b7280', fontSize: 13 },
  moneyVal: { fontWeight: 'bold', fontSize: 14, color: '#1e293b' },
  expandHint: { color: '#94a3b8', fontSize: 11, marginTop: 6 },
  lignes: { backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4 },
  ligneRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  ligneProduit: { color: '#334155', fontSize: 13, fontWeight: '500' },
  ligneQty: { color: '#64748b', fontSize: 12 },
  ligneSous: { color: '#1e88e5', fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  annulerBtn: { backgroundColor: '#fef2f2', borderRadius: 6, padding: 6, alignSelf: 'flex-start', marginTop: 10, borderWidth: 1, borderColor: '#fecaca' },
  annulerBtnText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  // Achats annulés
  separateurAnnules: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  separateurLine: { flex: 1, height: 1, backgroundColor: '#d1d5db' },
  separateurLabel: { color: '#9ca3af', fontSize: 12, marginHorizontal: 10, fontWeight: '500' },
  textAnnule: { color: '#9ca3af' },
  textBarre: { textDecorationLine: 'line-through' },
  // Situation
  sitTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 14, color: '#1e293b' },
  sitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sitLabel: { color: '#475569', fontSize: 14 },
  sitVal: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  // Produit picker
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#94a3b8', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 14, marginBottom: 8, backgroundColor: '#fff' },
  pickerVal: { color: '#1e293b', fontSize: 14 },
  pickerPh: { color: '#94a3b8', fontSize: 14 },
  pickerList: { backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', maxHeight: 180 },
  pickerItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  pickerItemText: { color: '#334155', fontSize: 13 },
  sectionLabel: { color: '#475569', fontSize: 13, marginBottom: 6 },
  modeBtn: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#1e88e5', borderColor: '#1e88e5' },
  modeBtnText: { color: '#374151', fontSize: 11, fontWeight: '500' },
  recuBtn: { backgroundColor: '#eff6ff', borderRadius: 6, padding: 6, alignSelf: 'flex-start', marginTop: 8 },
  recuBtnText: { color: '#1e88e5', fontSize: 12, fontWeight: '600' },
});
