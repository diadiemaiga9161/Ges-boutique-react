import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Linking, RefreshControl, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getVentes, getVentesParPeriode, getProduits, getCreditsNonRegles, getCreditsEnRetard, getSituationCredits,
  getCA30Jours, getTopProduits, getVentesParHeure, getPrevisionStock,
} from '../services/api.service';
import { imprimerRapportPdfRN } from '../services/invoice.service';
import {
  formaterDate, calculerRapport, totalVentes, getModePaiementLabel, MODE_PAIEMENT_ICONS, RapportCalcule,
} from '../services/rapport.helpers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useAuth } from '../hooks/useAuth';

type Periode = 'jour' | 'semaine' | 'mois' | 'perso';

const PERIODE_ICONS: Record<Periode, string> = {
  jour: 'weather-sunny', semaine: 'calendar-outline', mois: 'chart-bar', perso: 'tune-variant',
};
const PERIODE_LABELS_KEYS: Record<Periode, string> = {
  jour: 'rapport_journalier', semaine: 'rapport_semaine', mois: 'rapport_mois', perso: 'rapport_personnalise',
};

export default function RapportsScreen() {
  const { lang } = useLang();
  const { user } = useAuth();
  const isVendeur = user?.role === 'VENDEUR';
  const isAdmin = !isVendeur;

  const [activeReport, setActiveReport] = useState<Periode>('jour');
  const [selectedDate, setSelectedDate] = useState(formaterDate(new Date()));
  const [dateDebut, setDateDebut] = useState(formaterDate(new Date(Date.now() - 7 * 86400000)));
  const [dateFin, setDateFin] = useState(formaterDate(new Date()));

  const [daily, setDaily] = useState<RapportCalcule | null>(null);
  const [weekly, setWeekly] = useState<RapportCalcule | null>(null);
  const [monthly, setMonthly] = useState<RapportCalcule | null>(null);
  const [custom, setCustom] = useState<RapportCalcule | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [boutique, setBoutique] = useState<any>({});
  const [exporting, setExporting] = useState(false);

  // Hero — statistiques générales (indépendantes de la période active),
  // comme obtenirStatistiquesGenerales() sur Ionic.
  const [heroCAJour, setHeroCAJour] = useState(0);
  const [heroTotalVentes, setHeroTotalVentes] = useState(0);
  const [heroPanierMoyen, setHeroPanierMoyen] = useState(0);
  const [heroValeurStock, setHeroValeurStock] = useState(0);

  // Crédits clients
  const [creditsEnCours, setCreditsEnCours] = useState<any[]>([]);
  const [situationCredits, setSituationCredits] = useState<any>(null);
  const [creditsEnRetardCount, setCreditsEnRetardCount] = useState(0);

  // Analyses visuelles (inchangé)
  const [ca30Jours, setCA30Jours] = useState<any[]>([]);
  const [topProduitsAnalytics, setTopProduitsAnalytics] = useState<any[]>([]);
  const [ventesParHeure, setVentesParHeure] = useState<any[]>([]);
  const [previsionStock, setPrevisionStock] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [maxCA, setMaxCA] = useState(1);
  const [maxQte, setMaxQte] = useState(1);
  const [maxVentes, setMaxVentes] = useState(1);

  useEffect(() => {
    AsyncStorage.getItem('boutique_info').then(raw => {
      if (raw) setBoutique(JSON.parse(raw));
    });
    loadDaily();
    loadCredits();
    chargerHero();
    chargerAnalytics();
  }, []);

  // ─── Résumé par période — calcul client-side depuis /ventes/periode, comme
  //     rapport.service.ts (genererRapportJournalier/Hebdomadaire/Mensuel/
  //     Periodique) sur Ionic. Aucun endpoint /rapports/jour|semaine|mois côté
  //     backend, voir note dans api.service.ts. ────────────────────────────
  const chargerRapport = async (
    cacheKey: Periode, debut: string, fin: string, titre: string,
    setter: (r: RapportCalcule | null) => void,
  ) => {
    setLoading(true);
    try {
      const res = await getVentesParPeriode(debut, fin);
      const ventes = res.data?.data || res.data || [];
      const rapport = calculerRapport(ventes, titre, debut, fin);
      setter(rapport);
      setFromCache(false);
      AsyncStorage.setItem(`cache_rapport_${cacheKey}`, JSON.stringify(rapport)).catch(() => {});
    } catch {
      try {
        const s = await AsyncStorage.getItem(`cache_rapport_${cacheKey}`);
        if (s) { setter(JSON.parse(s)); setFromCache(true); }
        else setter(null);
      } catch { setter(null); }
    }
    setLoading(false);
    setRefreshing(false);
  };

  const loadDaily = (date?: string) => {
    const d = date || selectedDate;
    chargerRapport('jour', d, d, `Rapport du ${d}`, setDaily);
  };

  const loadWeekly = () => {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const debut = formaterDate(monday);
    const fin = formaterDate(today);
    chargerRapport('semaine', debut, fin, `Semaine du ${debut} au ${fin}`, setWeekly);
  };

  const loadMonthly = () => {
    const today = new Date();
    const debut = formaterDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const fin = formaterDate(today);
    const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    chargerRapport('mois', debut, fin, `${moisNoms[today.getMonth()]} ${today.getFullYear()}`, setMonthly);
  };

  const loadCustom = () => {
    if (!dateDebut || !dateFin) return;
    chargerRapport('perso', dateDebut, dateFin, 'Rapport personnalisé', setCustom);
  };

  const switchReport = (p: Periode) => {
    setActiveReport(p);
    if (p === 'jour' && !daily) loadDaily();
    if (p === 'semaine' && !weekly) loadWeekly();
    if (p === 'mois' && !monthly) loadMonthly();
    // 'perso' : chargé uniquement via le bouton "Générer" (comme Ionic)
  };

  const getActiveReport = (): RapportCalcule | null => {
    if (activeReport === 'jour') return daily;
    if (activeReport === 'semaine') return weekly;
    if (activeReport === 'mois') return monthly;
    return custom;
  };

  const refresh = () => {
    setRefreshing(true);
    if (activeReport === 'jour') loadDaily();
    else if (activeReport === 'semaine') loadWeekly();
    else if (activeReport === 'mois') loadMonthly();
    else loadCustom();
    loadCredits();
    chargerHero();
  };

  // ─── Hero (stats générales, indépendantes de la période active) ─────────
  const chargerHero = async () => {
    try {
      const [resVentes, resProduits] = await Promise.all([getVentes(), getProduits()]);
      const ventes = resVentes.data?.data || resVentes.data || [];
      const produits = resProduits.data?.data || resProduits.data || [];
      const today = formaterDate(new Date());
      const ventesJour = ventes.filter((v: any) => (v.dateVente || '').startsWith(today));
      setHeroCAJour(totalVentes(ventesJour));
      setHeroTotalVentes(ventes.length);
      setHeroPanierMoyen(ventes.length ? totalVentes(ventes) / ventes.length : 0);
      setHeroValeurStock(produits.reduce((s: number, p: any) => s + Number(p.prixAchat || 0) * Number(p.quantite || 0), 0));
    } catch { /* stats générales indisponibles — hero reste à 0, non bloquant */ }
  };

  // ─── Crédits clients ──────────────────────────────────────────────────────
  const loadCredits = async () => {
    try {
      const res = await getCreditsNonRegles();
      setCreditsEnCours(res.data?.credits || res.data?.data || []);
    } catch { setCreditsEnCours([]); }
    try {
      const res = await getSituationCredits();
      setSituationCredits(res.data?.situation || res.data?.data || res.data || null);
    } catch { setSituationCredits(null); }
    if (isAdmin) {
      try {
        const res = await getCreditsEnRetard();
        const list = res.data?.credits || res.data?.data || [];
        setCreditsEnRetardCount(Array.isArray(list) ? list.length : 0);
      } catch { setCreditsEnRetardCount(0); }
    }
  };

  const chargerAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        getCA30Jours().catch(() => ({ data: [] })),
        getTopProduits().catch(() => ({ data: [] })),
        getVentesParHeure().catch(() => ({ data: [] })),
        getPrevisionStock().catch(() => ({ data: [] })),
      ]);
      const d1: any[] = r1.data?.data || r1.data || [];
      const d2: any[] = r2.data?.data || r2.data || [];
      const d3: any[] = r3.data?.data || r3.data || [];
      const d4: any[] = r4.data?.data || r4.data || [];
      setCA30Jours(d1);
      setMaxCA(Math.max(...d1.map((x: any) => x.ca || 0), 1));
      setTopProduitsAnalytics(d2);
      setMaxQte(Math.max(...d2.map((x: any) => x.quantiteVendue || 0), 1));
      setVentesParHeure(d3);
      setMaxVentes(Math.max(...d3.map((x: any) => x.nbVentes || 0), 1));
      setPrevisionStock(d4);
    } catch {}
    setLoadingAnalytics(false);
  };

  const money = (v: number) => `${(v || 0).toLocaleString('fr-FR')} ${boutique.devise || 'FCFA'}`;

  const envoyerWhatsApp = () => {
    const r = getActiveReport();
    if (!r) return;
    const numeros = [boutique.telephone, boutique.telephone2, boutique.telephone3].filter(Boolean);
    if (!numeros.length) return;
    const msg = [
      `📊 *${r.titre}*`,
      `🏪 ${boutique.nom || ''}`,
      ``,
      !isVendeur ? `💰 CA : ${money(r.chiffreAffaireTotal)}` : null,
      `🛒 Ventes : ${r.nombreVentes}`,
    ].filter(Boolean).join('\n');

    numeros.forEach((num: string, i: number) => {
      setTimeout(() => {
        const clean = num.replace(/[\s()\-+]/g, '');
        Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`);
      }, i * 2500);
    });
  };

  const exporterPdf = async () => {
    const r = getActiveReport();
    if (!r) return;
    setExporting(true);
    try {
      // Même gabarit "document générique" 3-designs que sur Ionic (voir
      // invoice.service.ts) — design piloté par le même choix que les factures.
      const tpl = await AsyncStorage.getItem('facture_template');
      const design = tpl === 'moderne' ? 2 : tpl === 'minimaliste' ? 3 : 1;
      await imprimerRapportPdfRN({
        titre: r.titre,
        chiffreAffaireTotal: r.chiffreAffaireTotal,
        nombreVentes: r.nombreVentes,
        topProduits: r.topProduits.map(p => ({ nom: p.nom, quantite: p.quantite, chiffreAffaire: p.chiffreAffaire })),
      }, design);
    } catch { /* impression annulée ou indisponible — pas bloquant */ }
    setExporting(false);
  };

  const pct = (val: number, max: number) => (max > 0 ? (val / max) * 100 : 0);
  const rapport = getActiveReport();

  return (
    <View style={styles.container}>

      {/* ── Hero — statistiques générales ──────────────────────────────────── */}
      <View style={styles.hero}>
        {!isVendeur && (
          <>
            <Text style={styles.heroCA} numberOfLines={1}>{money(heroCAJour)}</Text>
            <Text style={styles.heroCALbl}>Chiffre d'affaires aujourd'hui</Text>
          </>
        )}
        <View style={styles.heroKpis}>
          <View style={styles.heroKpi}>
            <Text style={styles.heroKpiVal}>{heroTotalVentes}</Text>
            <Text style={styles.heroKpiLbl}>Ventes</Text>
          </View>
          {!isVendeur && (
            <>
              <View style={styles.heroKpi}>
                <Text style={styles.heroKpiVal} numberOfLines={1}>{money(heroPanierMoyen)}</Text>
                <Text style={styles.heroKpiLbl}>Panier moy.</Text>
              </View>
              <View style={styles.heroKpi}>
                <Text style={[styles.heroKpiVal, { color: '#fbbf24' }]}>{creditsEnRetardCount}</Text>
                <Text style={styles.heroKpiLbl}>Crédits retard</Text>
              </View>
              <View style={styles.heroKpi}>
                <Text style={styles.heroKpiVal} numberOfLines={1}>{money(heroValeurStock)}</Text>
                <Text style={styles.heroKpiLbl}>Valeur stock</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* ── Sélecteur de période ────────────────────────────────────────────── */}
      <View style={styles.periodSelector}>
        {(['jour', 'semaine', 'mois', 'perso'] as Periode[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.psBtn, activeReport === p && styles.psBtnActive]}
            onPress={() => switchReport(p)}
          >
            <MaterialCommunityIcons name={PERIODE_ICONS[p] as any} size={15} color={activeReport === p ? '#fff' : '#64748b'} />
            <Text style={[styles.psBtnText, activeReport === p && styles.psBtnTextActive]}>
              {p === 'perso' ? 'Perso' : tr(PERIODE_LABELS_KEYS[p], lang)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Bandeau offline ─────────────────────────────────────────────────── */}
      {fromCache && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={styles.offlineTxt}>Mode hors ligne — données locales</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#1a56db']} />}
      >
        <View style={{ padding: 16 }}>

          {/* Filtre date — Jour */}
          {activeReport === 'jour' && (
            <Card style={styles.filterCard}>
              <Card.Content style={styles.filterRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.filterLabel}>Date du rapport</Text>
                  <RNTextInput
                    style={styles.dateInput}
                    value={selectedDate}
                    onChangeText={setSelectedDate}
                    placeholder="AAAA-MM-JJ"
                  />
                </View>
                <Button mode="contained" onPress={() => loadDaily()} style={styles.genBtn} icon="chart-line">
                  Générer
                </Button>
              </Card.Content>
            </Card>
          )}

          {/* Filtre dates — Personnalisé */}
          {activeReport === 'perso' && (
            <Card style={styles.filterCard}>
              <Card.Content>
                <View style={styles.filterRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.filterLabel}>Du</Text>
                    <RNTextInput style={styles.dateInput} value={dateDebut} onChangeText={setDateDebut} placeholder="AAAA-MM-JJ" />
                  </View>
                  <Text style={{ marginHorizontal: 8, marginTop: 20, color: '#64748b' }}>→</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.filterLabel}>Au</Text>
                    <RNTextInput style={styles.dateInput} value={dateFin} onChangeText={setDateFin} placeholder="AAAA-MM-JJ" />
                  </View>
                </View>
                <Button mode="contained" onPress={loadCustom} style={{ marginTop: 10 }} icon="chart-line">
                  Générer le rapport personnalisé
                </Button>
              </Card.Content>
            </Card>
          )}

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} size="large" color="#1a56db" />
          ) : rapport ? (
            <>
              {/* ── Résumé du rapport actif ─────────────────────────────── */}
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.summaryHead}>
                    <Text variant="titleMedium" style={styles.cardTitle} numberOfLines={1}>{rapport.titre}</Text>
                    <TouchableOpacity onPress={exporterPdf} disabled={exporting} style={styles.exportBtn}>
                      <MaterialCommunityIcons name="download-outline" size={15} color="#1a56db" />
                      <Text style={styles.exportBtnText}>PDF</Text>
                    </TouchableOpacity>
                  </View>

                  {!isVendeur && (
                    <Text variant="headlineMedium" style={styles.bigNum}>{money(rapport.chiffreAffaireTotal)}</Text>
                  )}
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={styles.row}>
                    <Text>{tr('nb_ventes', lang)}</Text>
                    <Text style={styles.bold}>{rapport.nombreVentes}</Text>
                  </View>
                  {!isVendeur && rapport.montantRemisesTotal > 0 && (
                    <View style={styles.row}>
                      <Text>Remises</Text>
                      <Text style={styles.orange}>-{money(rapport.montantRemisesTotal)}</Text>
                    </View>
                  )}
                </Card.Content>
              </Card>

              {/* ── Top produits ────────────────────────────────────────── */}
              {rapport.topProduits.length > 0 && (
                <Card style={styles.card}>
                  <Card.Content>
                    <Text variant="titleMedium" style={styles.cardTitle}>Top {tr('produits', lang).toLowerCase()}</Text>
                    {rapport.topProduits.slice(0, 5).map((p, i) => (
                      <View key={i} style={styles.row}>
                        <Text style={{ flex: 1 }} numberOfLines={1}>{i + 1}. {p.nom}</Text>
                        <Text style={styles.bold}>{p.quantite} vendus</Text>
                      </View>
                    ))}
                  </Card.Content>
                </Card>
              )}

              {/* ── Modes de paiement ───────────────────────────────────── */}
              {rapport.modePaiementStats.length > 0 && (
                <Card style={styles.card}>
                  <Card.Content>
                    <Text variant="titleMedium" style={styles.cardTitle}>Modes de paiement</Text>
                    {rapport.modePaiementStats.map((m, i) => (
                      <View key={i} style={{ marginBottom: 10 }}>
                        <View style={styles.pmRow}>
                          <MaterialCommunityIcons name={(MODE_PAIEMENT_ICONS[m.mode] || 'wallet-outline') as any} size={16} color="#1a56db" />
                          <Text style={{ flex: 1, marginLeft: 8, fontSize: 13 }}>{getModePaiementLabel(m.mode)}</Text>
                          {!isVendeur && <Text style={styles.bold}>{money(m.montant)}</Text>}
                          <Text style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>{m.pourcentage.toFixed(1)}%</Text>
                        </View>
                        <View style={styles.pmBarWrap}>
                          <View style={[styles.pmBar, { width: `${m.pourcentage}%` as any }]} />
                        </View>
                      </View>
                    ))}
                  </Card.Content>
                </Card>
              )}

              {/* ── Bouton WhatsApp ─────────────────────────────────────── */}
              <Button mode="contained" icon="whatsapp" onPress={envoyerWhatsApp} style={[styles.btnWA, { backgroundColor: '#25D366' }]}>
                Envoyer sur WhatsApp
              </Button>
            </>
          ) : (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="chart-bar-stacked" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>{tr('aucun_resultat', lang)}</Text>
              <Text style={styles.emptySub}>Aucune donnée disponible pour cette période</Text>
            </View>
          )}

          {/* ── Crédits clients ─────────────────────────────────────────── */}
          {!isVendeur && situationCredits && (
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.creditsHead}>
                  <View style={styles.creditsIcon}>
                    <MaterialCommunityIcons name="hand-coin-outline" size={18} color="#f59e0b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Crédits clients</Text>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>Argent qui vous est dû</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: 'bold', color: '#dc2626' }}>
                      {money(situationCredits.montantTotalCredits || situationCredits.montantRestantTotal || 0)}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#64748b' }}>total dû</Text>
                  </View>
                </View>

                <View style={styles.creditsChips}>
                  <View style={[styles.creditChip, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#d97706" />
                    <Text style={[styles.creditChipVal, { color: '#d97706' }]}>{situationCredits.nombreCreditsNonRegles ?? creditsEnCours.length}</Text>
                    <Text style={styles.creditChipLbl}>En cours</Text>
                  </View>
                  <View style={[styles.creditChip, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#dc2626" />
                    <Text style={[styles.creditChipVal, { color: '#dc2626' }]}>{situationCredits.nombreCreditsEnRetard ?? creditsEnRetardCount}</Text>
                    <Text style={styles.creditChipLbl}>En retard</Text>
                  </View>
                </View>

                {creditsEnCours.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Détail ({creditsEnCours.length} crédit(s))</Text>
                    {creditsEnCours.slice(0, 5).map((c: any, i: number) => {
                      const pctVerse = c.montantTotal > 0 ? (c.montantVerse / c.montantTotal) * 100 : 0;
                      return (
                        <View key={i} style={styles.creditItem}>
                          <View style={styles.creditAvatar}>
                            <Text style={{ color: '#1a56db', fontWeight: 'bold' }}>{(c.clientNom || '?')[0].toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{c.clientNom}</Text>
                            <View style={styles.creditProgressWrap}>
                              <View style={styles.creditProgressBar}>
                                <View style={[styles.creditProgressFill, { width: `${pctVerse}%` as any }]} />
                              </View>
                              <Text style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>{pctVerse.toFixed(0)}%</Text>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#dc2626' }}>{money(c.montantRestant)}</Text>
                            {!!c.dateEcheance && <Text style={{ fontSize: 10, color: '#64748b' }}>{new Date(c.dateEcheance).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</Text>}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Card.Content>
            </Card>
          )}

          {/* ===== ANALYSES VISUELLES ===== */}
          {loadingAnalytics ? (
            <ActivityIndicator style={{ margin: 24 }} size="small" color="#1a56db" />
          ) : ((!isVendeur && ca30Jours.length > 0) || topProduitsAnalytics.length > 0 || ventesParHeure.length > 0) ? (
            <Card style={{ marginTop: 8, borderRadius: 12, elevation: 1 }}>
              <Card.Title title="Analyses visuelles" titleStyle={{ fontSize: 14 }} />
              <Card.Content>

                {!isVendeur && ca30Jours.length > 0 && (
                  <>
                    <Text style={{ fontWeight: '600', fontSize: 12, marginBottom: 6 }}>CA des 30 derniers jours</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 70, gap: 1, marginBottom: 16 }}>
                      {ca30Jours.map((d, i) => (
                        <View key={i} style={{ flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                          <View style={{ width: '100%', height: Math.max(2, pct(d.ca || 0, maxCA) * 0.7), backgroundColor: '#4f46e5', borderRadius: 2 }} />
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {topProduitsAnalytics.length > 0 && (
                  <>
                    <Divider style={{ marginVertical: 8 }} />
                    <Text style={{ fontWeight: '600', fontSize: 12, marginBottom: 6 }}>Top 10 produits</Text>
                    {topProduitsAnalytics.map((p, i) => (
                      <View key={i} style={{ marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: 11 }} numberOfLines={1}>{p.produitNom}</Text>
                          <Text style={{ fontSize: 11, color: '#6b7280' }}>{p.quantiteVendue}</Text>
                        </View>
                        <View style={{ backgroundColor: '#e5e7eb', borderRadius: 4, height: 6 }}>
                          <View style={{ width: `${pct(p.quantiteVendue || 0, maxQte)}%` as any, backgroundColor: '#10b981', height: '100%', borderRadius: 4 }} />
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {ventesParHeure.length > 0 && (
                  <>
                    <Divider style={{ marginVertical: 8 }} />
                    <Text style={{ fontWeight: '600', fontSize: 12, marginBottom: 6 }}>Ventes par heure</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 50, gap: 2 }}>
                      {ventesParHeure.map((h, i) => (
                        <View key={i} style={{ flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                          <View style={{ width: '100%', height: Math.max(2, pct(h.nbVentes || 0, maxVentes) * 0.5), backgroundColor: '#f59e0b', borderRadius: 2 }} />
                          <Text style={{ fontSize: 8, color: '#6b7280' }}>{h.heure}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

              </Card.Content>
            </Card>
          ) : null}

          {/* Prévisions de stock */}
          {previsionStock.length > 0 && (
            <Card style={{ marginTop: 12, borderRadius: 12, elevation: 1 }}>
              <Card.Title title="Prévisions de stock" titleStyle={{ fontSize: 14 }} />
              <Card.Content style={{ padding: 0 }}>
                {previsionStock.slice(0, 15).map((p, i) => (
                  <View key={i} style={{
                    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
                    borderBottomWidth: i < Math.min(previsionStock.length, 15) - 1 ? 1 : 0, borderBottomColor: '#f3f4f6',
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500' }}>{p.produitNom}</Text>
                      <Text style={{ fontSize: 10, color: '#6b7280' }}>
                        Stock: {p.stockActuel} | Jours: {p.joursAvantRupture >= 999 ? '—' : p.joursAvantRupture} | Reco: {p.quantiteRecommandee}
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: p.urgence === 'CRITIQUE' ? '#fee2e2' : p.urgence === 'ATTENTION' ? '#fef3c7' : '#dcfce7',
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
                    }}>
                      <Text style={{
                        fontSize: 10, fontWeight: '600',
                        color: p.urgence === 'CRITIQUE' ? '#dc2626' : p.urgence === 'ATTENTION' ? '#d97706' : '#16a34a',
                      }}>
                        {p.urgence}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Hero
  hero: { backgroundColor: '#081648', paddingVertical: 16, paddingHorizontal: 16 },
  heroCA: { color: '#fff', fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  heroCALbl: { color: '#93c5fd', fontSize: 11, textAlign: 'center', marginTop: 2, marginBottom: 12 },
  heroKpis: { flexDirection: 'row' },
  heroKpi: { flex: 1, alignItems: 'center' },
  heroKpiVal: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  heroKpiLbl: { color: '#93c5fd', fontSize: 10, marginTop: 2 },

  // Sélecteur de période
  periodSelector: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
  psBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9' },
  psBtnActive: { backgroundColor: '#1a56db' },
  psBtnText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  psBtnTextActive: { color: '#fff' },

  // Filtres date
  filterCard: { marginBottom: 12, borderRadius: 12, elevation: 1 },
  filterRow: { flexDirection: 'row', alignItems: 'flex-end' },
  filterLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  dateInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  genBtn: { marginLeft: 10 },

  // Offline
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  // Cards
  card: { marginBottom: 12, borderRadius: 12, elevation: 1 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontWeight: 'bold', color: '#1a56db', flex: 1 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: '#1a56db', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  exportBtnText: { color: '#1a56db', fontSize: 11, fontWeight: '700' },
  bigNum: { fontWeight: 'bold', color: '#1a56db', textAlign: 'center', marginVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  bold: { fontWeight: 'bold' },
  orange: { color: '#f59e0b', fontWeight: 'bold' },

  // Modes de paiement
  pmRow: { flexDirection: 'row', alignItems: 'center' },
  pmBarWrap: { backgroundColor: '#e5e7eb', borderRadius: 4, height: 6, marginTop: 4, marginLeft: 24 },
  pmBar: { backgroundColor: '#1a56db', height: '100%', borderRadius: 4 },

  // Crédits clients
  creditsHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  creditsIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' },
  creditsChips: { flexDirection: 'row', gap: 8, marginTop: 10 },
  creditChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  creditChipVal: { fontWeight: 'bold', fontSize: 14 },
  creditChipLbl: { fontSize: 10, color: '#64748b', marginLeft: 2 },
  creditItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  creditAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  creditProgressWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  creditProgressBar: { flex: 1, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2 },
  creditProgressFill: { height: '100%', backgroundColor: '#1a56db', borderRadius: 2 },

  // Empty state
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 40, paddingBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginTop: 4 },

  // WhatsApp
  btnWA: { marginTop: 4, marginBottom: 8, borderRadius: 8 },
});
