import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl, TouchableOpacity, ScrollView, Modal, TextInput, Linking } from 'react-native';
import { Text, FAB, ActivityIndicator, Switch, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { createPromotion, updatePromotion, getProduitsProchePeremption, getProduits, preparerWhatsAppPromotion } from '../services/api.service';
import { sauvegarderCache, lireCache, executerOuMettreEnFile } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useColors } from '../theme/colors';

interface Promotion {
  id: number;
  titre: string;
  description?: string;
  typeReduction: 'POURCENTAGE' | 'MONTANT_FIXE';
  valeurReduction: number;
  active: boolean;
  globale?: boolean;
  dateDebut?: string;
  dateFin?: string;
  produits?: { id: number; nom: string }[];
  // L'entité backend expose bien produitIds (List<Long>), pas d'objets {id,nom}
  // enrichis — voir Promotion.java côté Spring. Utilisé pour le filtrage des
  // suggestions (produit déjà couvert par une promo en cours) et pour le
  // sélecteur de produits en édition d'une promo "Par produits".
  produitIds?: number[];
}

interface ProduitLite {
  id: number;
  nom: string;
  prixVente: number;
}

interface WhatsAppLien {
  nom: string;
  telephone: string;
  url: string;
}

interface WhatsAppResult {
  promotion: Promotion;
  message: string;
  liens: WhatsAppLien[];
  totalClients: number;
  clientsAvecTelephone: number;
  clientsSansTelephone: number;
}

interface ProduitPeremption {
  id: number;
  nom: string;
  datePeremption: string | null;
  quantite: number;
  uniteMesure?: string;
  categorie?: { id: number; nom: string };
}

const money = (v: number) => v?.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' FCFA';
const dateStr = (d?: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PromotionsScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const s = createStyles(colors);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState({
    titre: '',
    description: '',
    typeReduction: 'POURCENTAGE' as 'POURCENTAGE' | 'MONTANT_FIXE',
    valeurReduction: '',
    active: true,
    globale: true,
    dateDebut: '',
    dateFin: '',
    produitIds: [] as number[],
  });
  const [saving, setSaving] = useState(false);
  // Suggestions de promo flash (produits proches de la date de péremption)
  const [suggestions, setSuggestions] = useState<ProduitPeremption[]>([]);
  // Produit ciblé quand le formulaire a été pré-rempli depuis une suggestion
  const [suggestedProduit, setSuggestedProduit] = useState<{ id: number; nom: string } | null>(null);

  // Sélecteur de produits pour les promos "Par produits" (form.globale === false)
  const [allProduits, setAllProduits] = useState<ProduitLite[]>([]);
  const [produitSearchSel, setProduitSearchSel] = useState('');
  const [showProduitDropdown, setShowProduitDropdown] = useState(false);

  // WhatsApp — envoi des promos aux clients (préparation des liens côté backend)
  const [boutique, setBoutique] = useState<any>({});
  const [showWAModal, setShowWAModal] = useState(false);
  const [waPromo, setWaPromo] = useState<Promotion | null>(null);
  const [waResult, setWaResult] = useState<WhatsAppResult | null>(null);
  const [loadingWA, setLoadingWA] = useState(false);
  const [searchWA, setSearchWA] = useState('');
  const [autoEnvoi, setAutoEnvoi] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoiIndex, setEnvoiIndex] = useState(0);

  const charger = async (event?: any) => {
    setLoading(true);
    try {
      const res = await api.get('/promotions');
      // BUG FIX (2026-08-14) : le backend renvoie { success, promotions: [...] },
      // pas { data: [...] } — l'ancien fallback sur res.data (l'objet entier, pas
      // un tableau) plantait tout render utilisant .filter/.map sur `promos`
      // ("undefined is not a function").
      const data = res.data?.promotions || res.data?.data || [];
      setPromos(data);
      setFromCache(false);
      sauvegarderCache('promotions', data).catch(() => {});
    } catch {
      const cached = await lireCache<Promotion>('promotions');
      if (cached.length > 0) { setPromos(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
    if (event?.target?.complete) event.target.complete();
  };

  // Réservé ADMIN côté backend (/api/produits/proche-peremption) : si l'appel
  // échoue (403 pour un compte non-admin, etc.), on échoue silencieusement —
  // la section Suggestions ne s'affiche simplement pas, pas d'Alert d'erreur.
  const chargerSuggestions = async () => {
    try {
      const res = await getProduitsProchePeremption(7);
      const data = Array.isArray(res.data) ? res.data : [];
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    }
  };

  // Produits disponibles pour le sélecteur "Par produits" — chargés une fois,
  // comme loadProduits() sur Ionic (ionViewWillEnter).
  const chargerProduits = async () => {
    try {
      const res = await getProduits();
      const data = res.data?.data || res.data || [];
      setAllProduits(data);
    } catch { setAllProduits([]); }
  };

  useEffect(() => {
    charger();
    chargerSuggestions();
    chargerProduits();
    AsyncStorage.getItem('boutique_info').then(raw => { if (raw) setBoutique(JSON.parse(raw)); });
  }, []);

  const openCreate = () => {
    setEditing(null);
    setSuggestedProduit(null);
    setProduitSearchSel('');
    setShowProduitDropdown(false);
    setForm({ titre: '', description: '', typeReduction: 'POURCENTAGE', valeurReduction: '', active: true, globale: true, dateDebut: todayISO(), dateFin: '', produitIds: [] });
    setShowModal(true);
  };

  const openEdit = (p: Promotion) => {
    setEditing(p);
    setSuggestedProduit(null);
    setProduitSearchSel('');
    setShowProduitDropdown(false);
    setForm({
      titre: p.titre,
      description: p.description || '',
      typeReduction: p.typeReduction,
      valeurReduction: String(p.valeurReduction),
      active: p.active,
      globale: p.globale ?? true,
      dateDebut: p.dateDebut ? p.dateDebut.slice(0, 10) : todayISO(),
      dateFin: p.dateFin ? p.dateFin.slice(0, 10) : '',
      produitIds: Array.isArray(p.produitIds) ? [...p.produitIds] : [],
    });
    setShowModal(true);
  };

  // Pré-remplit le formulaire de création à partir d'une suggestion — n'ouvre
  // que le modal, ne crée JAMAIS la promo automatiquement. L'utilisateur peut
  // modifier tous les champs (y compris la remise proposée) avant de valider
  // via le bouton "Créer" existant.
  const openCreateFromSuggestion = (prod: ProduitPeremption) => {
    setEditing(null);
    setSuggestedProduit({ id: prod.id, nom: prod.nom });
    setProduitSearchSel('');
    setShowProduitDropdown(false);
    setForm({
      titre: `Promo flash - ${prod.nom}`,
      description: '',
      typeReduction: 'POURCENTAGE',
      valeurReduction: '20',
      active: true,
      globale: false,
      dateDebut: todayISO(),
      dateFin: prod.datePeremption ? prod.datePeremption.slice(0, 10) : '',
      produitIds: [prod.id],
    });
    setShowModal(true);
  };

  // ── Sélecteur de produits (promo "Par produits") ────────────────────────
  const produitsFiltresSel = produitSearchSel.trim()
    ? allProduits.filter(p => p.nom.toLowerCase().includes(produitSearchSel.toLowerCase())).slice(0, 20)
    : allProduits.slice(0, 30);

  const isProduitSelectionneSel = (id: number) => form.produitIds.includes(id);

  const toggleProduitSel = (id: number) => {
    setForm(f => ({
      ...f,
      produitIds: f.produitIds.includes(id) ? f.produitIds.filter(x => x !== id) : [...f.produitIds, id],
    }));
  };

  const retirerProduitSel = (id: number) => {
    setForm(f => ({ ...f, produitIds: f.produitIds.filter(x => x !== id) }));
  };

  const getProduitNomSel = (id: number) => allProduits.find(p => p.id === id)?.nom || `#${id}`;

  const sauvegarder = async () => {
    if (!form.titre.trim()) { Alert.alert(tr('erreur', lang), tr('remplir_champs', lang)); return; }
    const valeur = parseFloat(form.valeurReduction);
    if (!valeur || valeur <= 0) { Alert.alert(tr('erreur', lang), tr('valeur', lang)); return; }
    if (form.typeReduction === 'POURCENTAGE' && valeur > 100) { Alert.alert(tr('erreur', lang), tr('remise', lang)); return; }
    if (!form.dateFin.trim()) { Alert.alert(tr('erreur', lang), tr('date_fin_obligatoire', lang)); return; }

    setSaving(true);
    try {
      const payload: any = {
        ...form,
        valeurReduction: valeur,
        dateDebut: form.dateDebut || todayISO(),
      };
      if (suggestedProduit) {
        payload.produitIds = [suggestedProduit.id];
      }
      let offline = false;
      if (editing) {
        const editingId = editing.id;
        const res = await executerOuMettreEnFile(
          'promotion_update',
          { id: editingId, data: payload },
          () => updatePromotion(editingId, payload)
        );
        offline = res.offline;
        if (offline) {
          setPromos(prev => prev.map(x => x.id === editingId ? { ...x, ...payload } : x));
        }
      } else {
        const res = await executerOuMettreEnFile(
          'promotion_create',
          payload,
          () => createPromotion(payload)
        );
        offline = res.offline;
      }
      setShowModal(false);
      if (offline) {
        Alert.alert('Sauvegardé', editing
          ? 'Modification sauvegardée hors ligne — sync au retour connexion'
          : 'Promotion sauvegardée hors ligne — sync au retour connexion');
      } else {
        charger();
      }
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || tr('erreur', lang));
    }
    setSaving(false);
  };

  const toggleActive = async (p: Promotion) => {
    try {
      const newData = { ...p, active: !p.active };
      const res = await executerOuMettreEnFile(
        'promotion_update',
        { id: p.id, data: newData },
        () => updatePromotion(p.id, newData)
      );
      setPromos(prev => prev.map(x => x.id === p.id ? { ...x, active: !x.active } : x));
      if (res.offline) {
        Alert.alert('Sauvegardé', 'Changement sauvegardé hors ligne — sync au retour connexion');
      }
    } catch { Alert.alert(tr('erreur', lang), tr('erreur', lang)); }
  };

  const supprimer = (p: Promotion) => {
    Alert.alert(tr('supprimer', lang), `${tr('supprimer', lang)} "${p.titre}" ?`, [
      { text: tr('annuler', lang), style: 'cancel' },
      {
        text: tr('supprimer', lang), style: 'destructive', onPress: async () => {
          try { await api.delete(`/promotions/${p.id}`); charger(); }
          catch { Alert.alert(tr('erreur', lang), tr('erreur', lang)); }
        }
      }
    ]);
  };

  // ── WhatsApp — envoi des promos aux clients (comme ouvrirWhatsApp() sur Ionic) ──
  const ouvrirWhatsApp = async (p: Promotion) => {
    setWaPromo(p);
    setShowWAModal(true);
    setWaResult(null);
    setSearchWA('');
    setAutoEnvoi(false);
    setEnvoiEnCours(false);
    setEnvoiIndex(0);
    setLoadingWA(true);
    try {
      const res = await preparerWhatsAppPromotion(p.id);
      setWaResult(res.data);
    } catch (e: any) {
      setShowWAModal(false);
      Alert.alert(tr('erreur', lang), e?.response?.data?.message || tr('erreur', lang));
    }
    setLoadingWA(false);
  };

  const fermerWhatsApp = () => {
    setShowWAModal(false);
    setWaResult(null);
    setEnvoiEnCours(false);
  };

  const liensWAFiltered = (waResult?.liens || []).filter(l => {
    const q = searchWA.toLowerCase().trim();
    if (!q) return true;
    return l.nom.toLowerCase().includes(q) || l.telephone.includes(q);
  });

  // Enrichit le lien wa.me (format fixe backend : https://wa.me/{tel}?text={enc})
  // avec la signature boutique + le label PROMOTION, comme enrichirUrl() sur Ionic.
  // Parsing manuel (pas de URL/URLSearchParams — non polyfillé sur Hermes ici).
  const enrichirUrlWA = (url: string): string => {
    const marker = '?text=';
    const idx = url.indexOf(marker);
    if (idx === -1) return url;
    const base = url.slice(0, idx);
    let rawText = '';
    try { rawText = decodeURIComponent(url.slice(idx + marker.length)); } catch { return url; }
    const sig = [
      '',
      '━━━━━━━━━━━━━━━',
      `🏪 *${boutique?.nom || 'Boutique'}*`,
      boutique?.telephone ? `📞 ${boutique.telephone}` : null,
      boutique?.adresse ? `📍 ${boutique.adresse}${boutique?.ville ? ', ' + boutique.ville : ''}` : null,
      boutique?.email ? `✉ ${boutique.email}` : null,
    ].filter(Boolean).join('\n');
    const enhanced = `🎁 *PROMOTION SPÉCIALE* 🎁\n\n${rawText}${sig}`;
    return `${base}${marker}${encodeURIComponent(enhanced)}`;
  };

  const envoyerUnWA = (lien: WhatsAppLien) => {
    Linking.openURL(enrichirUrlWA(lien.url)).catch(() =>
      Alert.alert(tr('erreur', lang), 'Impossible d\'ouvrir WhatsApp')
    );
  };

  // Envoi automatique : ouvre les liens WhatsApp un par un avec délai, comme
  // lancerEnvoiAuto() sur Ionic.
  const lancerEnvoiAutoWA = async () => {
    const liens = liensWAFiltered;
    if (liens.length === 0) return;
    setEnvoiEnCours(true);
    setEnvoiIndex(0);
    for (let i = 0; i < liens.length; i++) {
      setEnvoiIndex(i + 1);
      await Linking.openURL(enrichirUrlWA(liens[i].url)).catch(() => {});
      if (i < liens.length - 1) {
        await new Promise<void>(r => setTimeout(r, 1500));
      }
    }
    setEnvoiEnCours(false);
    Alert.alert(tr('succes', lang), `${liens.length} message(s) envoyé(s) !`);
  };

  const activeCount = promos.filter(p => p.active).length;
  const pctPromos = promos.filter(p => p.typeReduction === 'POURCENTAGE');
  const discountMoyen = pctPromos.length > 0
    ? Math.round(pctPromos.reduce((s, p) => s + p.valeurReduction, 0) / pctPromos.length)
    : 0;

  // Suggestions filtrées : on exclut les produits déjà couverts par une promo
  // active en cours (pas de nouvel appel réseau, on se base sur `promos`
  // déjà chargées). Un produit est "déjà couvert" si une promo active a
  // globale=true, ou globale=false avec produitIds contenant l'id du produit,
  // et que sa dateFin (si renseignée) n'est pas déjà dépassée.
  const today = todayISO();
  const suggestionsFiltrees = suggestions.filter(prod => {
    if (!prod.datePeremption) return false;
    const dejaCouvert = promos.some(p => {
      if (!p.active) return false;
      if (p.dateFin && p.dateFin.slice(0, 10) < today) return false;
      if (p.globale) return true;
      return Array.isArray(p.produitIds) && p.produitIds.includes(prod.id);
    });
    return !dejaCouvert;
  });

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />;

  return (
    <View style={s.container}>
      {/* Hero banner */}
      <View style={s.hero}>
        <View style={s.heroStat}>
          <Text style={s.heroVal}>{promos.length}</Text>
          <Text style={s.heroLbl}>{tr('total_promos', lang)}</Text>
        </View>
        <View style={s.heroStat}>
          <Text style={s.heroVal}>{activeCount}</Text>
          <Text style={s.heroLbl}>{tr('active', lang)}</Text>
        </View>
        <View style={s.heroStat}>
          <Text style={s.heroVal}>{discountMoyen > 0 ? `${discountMoyen}%` : promos.length - activeCount}</Text>
          <Text style={s.heroLbl}>{discountMoyen > 0 ? 'Remise moy.' : tr('inactive', lang)}</Text>
        </View>
      </View>

      {/* Suggestions de promo flash — produits proches de la péremption.
          N'apparaît que si l'appel ADMIN a réussi et qu'il reste des produits
          non déjà couverts par une promo active. Ne crée jamais rien tout
          seul : chaque bouton ouvre juste le modal existant pré-rempli. */}
      {suggestionsFiltrees.length > 0 && (
        <View style={s.suggestionsSection}>
          <View style={s.suggestionsHeader}>
            <MaterialCommunityIcons name="clock-alert-outline" size={18} color={colors.warning} />
            <Text style={s.suggestionsTitle}>{tr('suggestions_promo', lang)}</Text>
          </View>
          <Text style={s.suggestionsSub}>{tr('suggestions_promo_sub', lang)}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 4 }}
          >
            {suggestionsFiltrees.map(prod => {
              const jours = prod.datePeremption
                ? Math.ceil((new Date(prod.datePeremption).getTime() - Date.now()) / 86400000)
                : null;
              return (
                <View key={prod.id} style={s.suggestionCard}>
                  <Text style={s.suggestionNom} numberOfLines={1}>{prod.nom}</Text>
                  <Text style={s.suggestionInfo}>
                    {tr('stock', lang)}: {prod.quantite} {prod.uniteMesure || ''}
                  </Text>
                  <Text style={s.suggestionInfo}>{dateStr(prod.datePeremption)}</Text>
                  {jours !== null && (
                    <Text style={[s.suggestionJours, jours <= 2 && { color: colors.danger }]}>
                      {tr('expire_dans', lang)} {jours} {tr('jours_unite', lang)}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={s.suggestionBtn}
                    onPress={() => openCreateFromSuggestion(prod)}
                  >
                    <MaterialCommunityIcons name="tag-plus-outline" size={14} color="#fff" />
                    <Text style={s.suggestionBtnText}>{tr('creer_promo_suggestion', lang)}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={promos}
        keyExtractor={p => String(p.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 90, paddingTop: 8 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <MaterialCommunityIcons name="tag-off-outline" size={64} color={colors.border} />
            <Text style={s.emptyTitle}>{tr('aucune_promo', lang)}</Text>
            <Text style={s.emptySub}>Commencez par créer une promotion</Text>
          </View>
        }
        renderItem={({ item: p }) => (
          <Card style={[s.card, !p.active && s.cardInactive]}>
            <Card.Content>
              {/* En-tête */}
              <View style={s.cardHeader}>
                <View style={[s.avatar, { backgroundColor: colors.infoBg }]}>
                  <MaterialCommunityIcons name="tag" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName} numberOfLines={1}>{p.titre}</Text>
                  <View style={s.cardBadges}>
                    <View style={[s.badge, p.globale ? s.badgeGlobal : s.badgeProduit]}>
                      <Text style={s.badgeText}>{p.globale ? tr('globale', lang) : tr('par_produit', lang)}</Text>
                    </View>
                    <View style={[s.badge, p.active ? s.badgeActive : s.badgeInactive]}>
                      <Text style={[s.badgeText, { color: p.active ? colors.success : colors.textSecondary }]}>
                        {p.active ? '● ' + tr('active', lang) : '○ ' + tr('inactive', lang)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Switch value={p.active} onValueChange={() => toggleActive(p)} color={colors.primary} />
              </View>

              {/* Réduction */}
              <View style={s.reductionRow}>
                <MaterialCommunityIcons
                  name={p.typeReduction === 'POURCENTAGE' ? 'percent' : 'currency-usd-off'}
                  size={16} color={colors.primary}
                />
                <Text style={s.reductionText}>
                  {p.typeReduction === 'POURCENTAGE'
                    ? `${p.valeurReduction}% ${tr('remise', lang).toLowerCase()}`
                    : `${money(p.valeurReduction)} ${tr('remise', lang).toLowerCase()}`}
                </Text>
              </View>

              {/* Dates */}
              {(p.dateDebut || p.dateFin) && (
                <Text style={s.dates}>
                  <MaterialCommunityIcons name="calendar-range" size={12} />
                  {' '}{dateStr(p.dateDebut)} → {dateStr(p.dateFin)}
                </Text>
              )}

              {/* Produits liés */}
              {p.produits && p.produits.length > 0 && (
                <Text style={s.produitsList}>
                  Produits : {p.produits.map(pr => pr.nom).join(', ')}
                </Text>
              )}

              {/* WhatsApp — envoyer la promo aux clients */}
              <TouchableOpacity style={s.waBtn} onPress={() => ouvrirWhatsApp(p)}>
                <MaterialCommunityIcons name="whatsapp" size={16} color="#fff" />
                <Text style={s.waBtnText}>WhatsApp</Text>
              </TouchableOpacity>

              {/* Actions */}
              <View style={s.cardActions}>
                <TouchableOpacity style={s.editBtn} onPress={() => openEdit(p)}>
                  <MaterialCommunityIcons name="pencil-outline" size={15} color={colors.primary} />
                  <Text style={s.editBtnText}>{tr('modifier', lang)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.deleteBtn} onPress={() => supprimer(p)}>
                  <MaterialCommunityIcons name="trash-can-outline" size={15} color={colors.danger} />
                  <Text style={s.deleteBtnText}>{tr('supprimer', lang)}</Text>
                </TouchableOpacity>
              </View>
            </Card.Content>
          </Card>
        )}
      />

      <FAB icon="plus" style={s.fab} color="#fff" onPress={openCreate} />

      {/* Modal créer/modifier */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>{editing ? tr('modifier_promo', lang) : tr('nouvelle_promo', lang)}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              <Text style={s.fieldLabel}>{tr('titre_promo', lang)}</Text>
              <TextInput
                style={s.input}
                value={form.titre}
                onChangeText={t => setForm({ ...form, titre: t })}
                placeholder="Ex: Promo Ramadan, -20%..."
                placeholderTextColor={colors.placeholder}
              />

              <Text style={s.fieldLabel}>{tr('description', lang)}</Text>
              <TextInput
                style={[s.input, { height: 70, textAlignVertical: 'top' }]}
                value={form.description}
                onChangeText={t => setForm({ ...form, description: t })}
                placeholder={tr('description', lang)}
                placeholderTextColor={colors.placeholder}
                multiline
              />

              <Text style={s.fieldLabel}>{tr('type_reduction', lang)}</Text>
              <View style={s.typeRow}>
                {(['POURCENTAGE', 'MONTANT_FIXE'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeBtn, form.typeReduction === t && s.typeBtnActive]}
                    onPress={() => setForm({ ...form, typeReduction: t })}
                  >
                    <MaterialCommunityIcons
                      name={t === 'POURCENTAGE' ? 'percent' : 'cash-minus'}
                      size={16} color={form.typeReduction === t ? '#fff' : colors.primary}
                    />
                    <Text style={[s.typeBtnText, form.typeReduction === t && { color: '#fff' }]}>
                      {t === 'POURCENTAGE' ? tr('pourcentage', lang) : tr('montant_fixe', lang)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>
                {tr('valeur', lang)} {form.typeReduction === 'POURCENTAGE' ? '(%)' : '(FCFA)'} *
              </Text>
              <TextInput
                style={s.input}
                value={form.valeurReduction}
                onChangeText={t => setForm({ ...form, valeurReduction: t })}
                keyboardType="numeric"
                placeholder={form.typeReduction === 'POURCENTAGE' ? 'Ex: 20' : 'Ex: 5000'}
                placeholderTextColor={colors.placeholder}
              />

              <Text style={s.fieldLabel}>{tr('date_fin_promo', lang)}</Text>
              <TextInput
                style={s.input}
                value={form.dateFin}
                onChangeText={t => setForm({ ...form, dateFin: t })}
                placeholder="AAAA-MM-JJ"
                autoCapitalize="none"
                placeholderTextColor={colors.placeholder}
              />

              {suggestedProduit && (
                <View style={s.produitCibleTag}>
                  <MaterialCommunityIcons name="tag-outline" size={14} color={colors.primary} />
                  <Text style={s.produitCibleText}>
                    {tr('produit_cible', lang)} : {suggestedProduit.nom}
                  </Text>
                </View>
              )}

              <View style={s.switchRow}>
                <View>
                  <Text style={s.fieldLabel}>{tr('promo_globale', lang)}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{tr('applique_tous', lang)}</Text>
                </View>
                <Switch
                  value={form.globale}
                  onValueChange={v => setForm(f => ({ ...f, globale: v, produitIds: v ? [] : f.produitIds }))}
                  color={colors.primary}
                />
              </View>

              {/* Sélecteur produits — uniquement pour une promo "Par produits" */}
              {!form.globale && (
                <View style={s.produitSelBox}>
                  <View style={s.produitSelHeader}>
                    <MaterialCommunityIcons name="cube-outline" size={15} color={colors.primary} />
                    <Text style={s.produitSelLabel}>{tr('par_produit', lang)}</Text>
                    {form.produitIds.length > 0 && (
                      <Text style={s.produitSelCount}>{form.produitIds.length} sélectionné(s)</Text>
                    )}
                  </View>

                  {form.produitIds.length > 0 && (
                    <View style={s.produitChips}>
                      {form.produitIds.map(id => (
                        <View key={id} style={s.produitChip}>
                          <Text style={s.produitChipText} numberOfLines={1}>{getProduitNomSel(id)}</Text>
                          <TouchableOpacity onPress={() => retirerProduitSel(id)}>
                            <MaterialCommunityIcons name="close-circle" size={15} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <TextInput
                    style={s.input}
                    value={produitSearchSel}
                    onChangeText={t => { setProduitSearchSel(t); setShowProduitDropdown(true); }}
                    onFocus={() => setShowProduitDropdown(true)}
                    placeholder={tr('recherche_produit', lang)}
                    placeholderTextColor={colors.placeholder}
                  />

                  {showProduitDropdown && (
                    <View style={s.produitDropdown}>
                      {produitsFiltresSel.length === 0 ? (
                        <Text style={s.produitDropdownEmpty}>{tr('aucun_resultat', lang)}</Text>
                      ) : produitsFiltresSel.map(p => (
                        <TouchableOpacity key={p.id} style={s.produitOption} onPress={() => toggleProduitSel(p.id)}>
                          <MaterialCommunityIcons
                            name={isProduitSelectionneSel(p.id) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                            size={17}
                            color={isProduitSelectionneSel(p.id) ? colors.primary : colors.textSecondary}
                          />
                          <Text style={s.produitOptionText} numberOfLines={1}>{p.nom}</Text>
                          <Text style={s.produitOptionPrix}>{money(p.prixVente)}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity style={s.produitDropdownClose} onPress={() => setShowProduitDropdown(false)}>
                        <Text style={s.produitDropdownCloseText}>Fermer</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              <View style={s.switchRow}>
                <Text style={s.fieldLabel}>{tr('active', lang)}</Text>
                <Switch
                  value={form.active}
                  onValueChange={v => setForm({ ...form, active: v })}
                  color={colors.primary}
                />
              </View>
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowModal(false)}>
                <Text style={s.btnCancelText}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnConfirm, saving && { opacity: 0.6 }]} onPress={sauvegarder} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.btnConfirmText}>{editing ? tr('enregistrer', lang) : tr('creer', lang)}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal WhatsApp — envoi de la promo aux clients (comme la modale
          WhatsApp maison sur Ionic, promotions.page.html) */}
      <Modal visible={showWAModal} animationType="slide" onRequestClose={fermerWhatsApp}>
        <View style={[s.modalHeaderFull, { backgroundColor: '#16a34a' }]}>
          <Text style={s.modalTitleFull} numberOfLines={1}>WhatsApp{waPromo ? ` — ${waPromo.titre}` : ''}</Text>
          <TouchableOpacity onPress={fermerWhatsApp}>
            <MaterialCommunityIcons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        {loadingWA ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
        ) : waResult ? (
          <ScrollView style={s.waBody} keyboardShouldPersistTaps="handled">
            {/* Aperçu message */}
            <Text style={s.waPreviewLabel}>Aperçu du message</Text>
            <View style={s.waBubble}>
              <Text style={s.waBubbleBadge}>🎁 PROMOTION SPÉCIALE 🎁</Text>
              <Text style={s.waBubbleMsg}>{waResult.message}</Text>
              <Text style={s.waBubbleHint}>+ vos infos boutique seront ajoutées</Text>
            </View>

            {/* Stats */}
            <View style={s.waStats}>
              <View style={s.waStat}>
                <Text style={s.waStatVal}>{waResult.totalClients}</Text>
                <Text style={s.waStatLbl}>Total clients</Text>
              </View>
              <View style={s.waStat}>
                <Text style={[s.waStatVal, { color: colors.success }]}>{waResult.clientsAvecTelephone}</Text>
                <Text style={s.waStatLbl}>Avec téléphone</Text>
              </View>
              <View style={s.waStat}>
                <Text style={[s.waStatVal, { color: colors.warning }]}>{waResult.clientsSansTelephone}</Text>
                <Text style={s.waStatLbl}>Sans téléphone</Text>
              </View>
            </View>

            {/* Envoi automatique */}
            <View style={s.waAutoRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.waAutoTitle}>Envoi automatique</Text>
                <Text style={s.waAutoSub}>Ouvre WhatsApp pour chaque client sans confirmation</Text>
              </View>
              <Switch value={autoEnvoi} onValueChange={setAutoEnvoi} color="#16a34a" />
            </View>

            {autoEnvoi && (
              <TouchableOpacity
                style={[s.waSendAllBtn, (envoiEnCours || liensWAFiltered.length === 0) && { opacity: 0.6 }]}
                disabled={envoiEnCours || liensWAFiltered.length === 0}
                onPress={lancerEnvoiAutoWA}
              >
                <MaterialCommunityIcons name="send-outline" size={16} color="#fff" />
                <Text style={s.waSendAllBtnText}>
                  {envoiEnCours ? `Envoi ${envoiIndex} / ${liensWAFiltered.length}...` : `${tr('envoyer', lang)} (${liensWAFiltered.length} clients)`}
                </Text>
              </TouchableOpacity>
            )}

            {/* Recherche */}
            <TextInput
              style={s.input}
              value={searchWA}
              onChangeText={setSearchWA}
              placeholder={tr('recherche_client', lang)}
              placeholderTextColor={colors.placeholder}
            />

            {liensWAFiltered.length === 0 ? (
              <Text style={s.waEmpty}>{tr('aucun_resultat', lang)}</Text>
            ) : (
              liensWAFiltered.map((lien, i) => (
                <View key={`${lien.telephone}-${i}`} style={s.waClientRow}>
                  <View style={s.waClientAvatar}>
                    <Text style={s.waClientAvatarText}>{lien.nom.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.waClientNom} numberOfLines={1}>{lien.nom}</Text>
                    <Text style={s.waClientTel}>{lien.telephone}</Text>
                  </View>
                  <TouchableOpacity style={s.waSendBtn} onPress={() => envoyerUnWA(lien)}>
                    <MaterialCommunityIcons name="whatsapp" size={14} color="#fff" />
                    <Text style={s.waSendBtnText}>{tr('envoyer', lang)}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        ) : null}
      </Modal>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  hero: { backgroundColor: colors.hero, flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },

  // Suggestions promo flash (produits proches de la péremption)
  suggestionsSection: { backgroundColor: colors.warningBg, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: colors.warning },
  suggestionsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  suggestionsTitle: { fontWeight: '700', fontSize: 14, color: colors.warning },
  suggestionsSub: { fontSize: 11, color: colors.warning, paddingHorizontal: 12, marginTop: 2, marginBottom: 8 },
  suggestionCard: { width: 170, backgroundColor: colors.card, borderRadius: 12, padding: 10, marginRight: 8, borderWidth: 1, borderColor: colors.warning },
  suggestionNom: { fontWeight: '600', fontSize: 13, color: colors.text, marginBottom: 4 },
  suggestionInfo: { fontSize: 11, color: colors.textSecondary },
  suggestionJours: { fontSize: 11, fontWeight: '700', color: colors.warning, marginTop: 4 },
  suggestionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#d97706', borderRadius: 8, paddingVertical: 6, marginTop: 8 },
  suggestionBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  produitCibleTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.infoBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 12 },
  produitCibleText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2 },

  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.warningBg, paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: colors.warning, fontSize: 12 },

  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 16, elevation: 1, backgroundColor: colors.card },
  cardInactive: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: colors.text, marginBottom: 4 },
  cardBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeGlobal: { backgroundColor: colors.infoBg },
  badgeProduit: { backgroundColor: '#f3e5f5' },
  badgeActive: { backgroundColor: colors.successBg },
  badgeInactive: { backgroundColor: colors.inputBg },
  badgeText: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },

  reductionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  reductionText: { color: colors.primary, fontWeight: 'bold', fontSize: 14 },
  dates: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  produitsList: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic', marginBottom: 6 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingVertical: 7 },
  editBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.danger, borderRadius: 8, paddingVertical: 7 },
  deleteBtnText: { color: colors.danger, fontSize: 13, fontWeight: '600' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginTop: 12 },
  emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },

  fab: { position: 'absolute', bottom: 20, right: 16, backgroundColor: colors.primary },

  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontWeight: 'bold', fontSize: 16, color: colors.text },
  modalBody: { padding: 16, maxHeight: 420 },
  modalFoot: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },

  fieldLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, backgroundColor: colors.inputBg },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingVertical: 10 },
  typeBtnActive: { backgroundColor: colors.primary },
  typeBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },

  btnCancel: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnCancelText: { color: colors.textSecondary, fontWeight: '600' },
  btnConfirm: { flex: 2, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Bouton WhatsApp sur la carte promo
  waBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 9, marginTop: 8 },
  waBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Sélecteur de produits (promo "Par produits")
  produitSelBox: { backgroundColor: colors.infoBg, borderRadius: 12, padding: 12, marginTop: 14 },
  produitSelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  produitSelLabel: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  produitSelCount: { fontSize: 11, color: colors.textSecondary, marginLeft: 'auto' },
  produitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  produitChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 200, borderWidth: 1, borderColor: colors.primary },
  produitChipText: { fontSize: 12, color: colors.text, maxWidth: 150 },
  produitDropdown: { backgroundColor: colors.card, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: colors.border, maxHeight: 220 },
  produitOption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  produitOptionText: { flex: 1, fontSize: 13, color: colors.text },
  produitOptionPrix: { fontSize: 11, color: colors.textSecondary },
  produitDropdownEmpty: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', paddingVertical: 12 },
  produitDropdownClose: { paddingVertical: 9, alignItems: 'center' },
  produitDropdownCloseText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // Modal WhatsApp
  modalHeaderFull: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  modalTitleFull: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, marginRight: 12 },
  waBody: { flex: 1, padding: 16, backgroundColor: colors.background },
  waPreviewLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  waBubble: { backgroundColor: '#dcf8c6', borderRadius: 12, padding: 12, marginBottom: 16 },
  waBubbleBadge: { fontWeight: '700', fontSize: 13, marginBottom: 6, color: '#166534' },
  waBubbleMsg: { fontSize: 13, color: '#1e293b', lineHeight: 19 },
  waBubbleHint: { fontSize: 11, color: '#166534', marginTop: 8, fontStyle: 'italic' },
  waStats: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  waStat: { flex: 1, backgroundColor: colors.card, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  waStatVal: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  waStatLbl: { fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  waAutoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  waAutoTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  waAutoSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  waSendAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 12, marginBottom: 14 },
  waSendAllBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  waEmpty: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, marginTop: 20 },
  waClientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: colors.border },
  waClientAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' },
  waClientAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  waClientNom: { fontSize: 13, fontWeight: '600', color: colors.text },
  waClientTel: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  waSendBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  waSendBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
