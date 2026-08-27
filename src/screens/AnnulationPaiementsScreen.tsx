import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Text, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getPaiementsFournisseur,
  annulerPaiementFournisseur,
  getReglements,
  annulerReglementCredit,
} from '../services/api.service';
import { sauvegarderCache, lireCache } from '../services/offline.service';

type Periode = 'today' | 'week' | 'month' | 'year' | 'all';
type Onglet = 'fournisseur' | 'credit';

const CACHE_PAIEMENTS = 'annulation_paiements_fournisseur';
const CACHE_REGLEMENTS = 'annulation_reglements_credit';

const PERIODES: Array<{ key: Periode; label: string }> = [
  { key: 'today', label: 'Auj.' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'year', label: 'Année' },
  { key: 'all', label: 'Tout' },
];

function getDateRange(period: Periode): { dateDebut: string; dateFin: string } {
  if (period === 'all') return { dateDebut: '', dateFin: '' };
  const today = new Date();
  const fin = today.toISOString().split('T')[0];
  let debut = fin;
  if (period === 'week') {
    const d = new Date(today);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    debut = d.toISOString().split('T')[0];
  } else if (period === 'month') {
    debut = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split('T')[0];
  } else if (period === 'year') {
    debut = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
  }
  return { dateDebut: debut, dateFin: fin };
}

export default function AnnulationPaiementsScreen() {
  const [onglet, setOnglet] = useState<Onglet>('fournisseur');
  const [paiements, setPaiements] = useState<any[]>([]);
  const [reglements, setReglements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Periode>('all');
  const [userId, setUserId] = useState<number | null>(null);

  // Lire l'utilisateur depuis AsyncStorage (même pattern que MenuScreen)
  React.useEffect(() => {
    AsyncStorage.getItem('user').then((raw) => {
      if (raw) {
        const u = JSON.parse(raw);
        setUserId(u?.id ?? null);
      }
    });
  }, []);

  const charger = useCallback(
    async (period: Periode = selectedPeriod, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const range = getDateRange(period);
      const params = range.dateDebut ? range : undefined;
      // Toujours tenter l'appel réel en premier — NetInfo.fetch() peut renvoyer
      // isConnected=null au premier appel et ferait sauter l'appel réel à tort.

      try {
        if (onglet === 'fournisseur') {
          const res = await getPaiementsFournisseur(params);
          setPaiements(res.data);
          await sauvegarderCache(CACHE_PAIEMENTS, res.data);
          setFromCache(false);
        } else {
          const res = await getReglements(params);
          setReglements(res.data);
          await sauvegarderCache(CACHE_REGLEMENTS, res.data);
          setFromCache(false);
        }
      } catch {
        if (onglet === 'fournisseur') {
          const cached = await lireCache<any>(CACHE_PAIEMENTS);
          setPaiements(cached);
        } else {
          const cached = await lireCache<any>(CACHE_REGLEMENTS);
          setReglements(cached);
        }
        setFromCache(true);
      }

      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    },
    [onglet, selectedPeriod],
  );

  // Charger au premier rendu et quand l'onglet change
  React.useEffect(() => {
    charger();
  }, [onglet]);

  const selectPeriod = (p: Periode) => {
    setSelectedPeriod(p);
    charger(p);
  };

  const confirmerAnnulation = (item: any, type: Onglet) => {
    const label =
      type === 'fournisseur'
        ? `Annuler le paiement de ${fmt(item.montant)} a ${item.fournisseur?.nom || '?'} ?`
        : `Annuler le reglement de ${fmt(item.montant)} pour ${item.clientNom || '?'} ?`;

    Alert.alert(
      'Annuler ce paiement ?',
      label + "\n\nL'argent sera remis a sa source (caisse ou banque).",
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            const net = await NetInfo.fetch();
            if (!net.isConnected) {
              Alert.alert(
                'Connexion requise',
                'Une connexion internet est necessaire pour annuler un paiement.',
              );
              return;
            }
            if (!userId) {
              Alert.alert('Erreur', 'Utilisateur non identifie. Reconnectez-vous.');
              return;
            }
            try {
              if (type === 'fournisseur') {
                await annulerPaiementFournisseur(item.id, userId);
              } else {
                await annulerReglementCredit(item.id, userId);
              }
              Alert.alert('Succes', 'Paiement annule avec succes');
              charger();
            } catch (e: any) {
              Alert.alert(
                'Erreur',
                e?.response?.data?.message || "Impossible d'annuler ce paiement",
              );
            }
          },
        },
      ],
    );
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat('fr-FR').format(v || 0) + ' F';

  const fmtDate = (d: string) => {
    if (!d) return '';
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const currentList = onglet === 'fournisseur' ? paiements : reglements;
  const countAnnules = currentList.filter((x) => x.annule).length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => charger(selectedPeriod, true)}
          tintColor="#fff"
        />
      }
    >
      {/* Hero banner */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Gestion</Text>
        <Text style={styles.heroTitle}>Annulation paiements</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{currentList.length}</Text>
            <Text style={styles.heroStatLbl}>Operations</Text>
          </View>
          <View style={styles.heroStatSep} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatVal, { color: '#fca5a5' }]}>
              {countAnnules}
            </Text>
            <Text style={styles.heroStatLbl}>Annules</Text>
          </View>
        </View>
      </View>


      <View style={styles.body}>
        {/* Onglets type */}
        <View style={styles.chips}>
          {(['fournisseur', 'credit'] as Onglet[]).map((o) => (
            <TouchableOpacity
              key={o}
              style={[styles.chip, onglet === o && styles.chipActive]}
              onPress={() => setOnglet(o)}
            >
              <Text
                style={[styles.chipTxt, onglet === o && styles.chipTxtActive]}
              >
                {o === 'fournisseur' ? 'Paiements fournisseur' : 'Reglements credit'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filtres période */}
        <View style={styles.chips}>
          {PERIODES.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.chip,
                styles.chipSm,
                selectedPeriod === p.key && styles.chipActive,
              ]}
              onPress={() => selectPeriod(p.key)}
            >
              <Text
                style={[
                  styles.chipTxt,
                  styles.chipTxtSm,
                  selectedPeriod === p.key && styles.chipTxtActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Loading */}
        {loading && (
          <ActivityIndicator color="#1a56db" style={{ marginTop: 32 }} />
        )}

        {/* Liste */}
        {!loading &&
          currentList.map((item) => {
            const annule = item.annule;
            const nom =
              onglet === 'fournisseur'
                ? item.fournisseur?.nom || 'Fournisseur'
                : item.clientNom || 'Client';
            const date =
              onglet === 'fournisseur' ? item.datePaiement : item.dateOperation;
            const annuleDate =
              onglet === 'fournisseur'
                ? item.dateAnnulation
                : item.dateAnnulationReglement;

            return (
              <Card
                key={item.id}
                style={[styles.card, annule && { opacity: 0.6 }]}
              >
                <Card.Content>
                  <View style={styles.cardRow}>
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: annule ? '#fef2f2' : '#eff6ff' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          annule
                            ? 'close-circle-outline'
                            : onglet === 'fournisseur'
                            ? 'cash'
                            : 'card-account-details-outline'
                        }
                        size={22}
                        color={annule ? '#dc2626' : '#1a56db'}
                      />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{nom}</Text>
                      <Text style={styles.cardSub}>{fmtDate(date)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={[
                          styles.cardAmt,
                          annule && { color: '#dc2626' },
                        ]}
                      >
                        {fmt(item.montant)}
                      </Text>
                      {annule && (
                        <Text style={styles.badgeAnnule}>Annule</Text>
                      )}
                    </View>
                  </View>

                  {onglet === 'fournisseur' && item.modePaiement && (
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor:
                            item.modePaiement === 'ESPECES'
                              ? '#eff6ff'
                              : '#f5f3ff',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          color:
                            item.modePaiement === 'ESPECES'
                              ? '#1a56db'
                              : '#7c3aed',
                        }}
                      >
                        {item.modePaiement === 'ESPECES' ? 'Especes' : 'Banque'}
                      </Text>
                    </View>
                  )}

                  {onglet === 'credit' && item.clientTelephone && (
                    <Text style={styles.cardSub}>{item.clientTelephone}</Text>
                  )}

                  {annule && annuleDate && (
                    <Text
                      style={[
                        styles.cardSub,
                        { color: '#dc2626', marginTop: 4 },
                      ]}
                    >
                      Annule le {fmtDate(annuleDate)}
                    </Text>
                  )}

                  {!annule && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => confirmerAnnulation(item, onglet)}
                    >
                      <MaterialCommunityIcons
                        name="close-circle-outline"
                        size={16}
                        color="#dc2626"
                      />
                      <Text style={styles.cancelBtnTxt}>
                        Annuler ce paiement
                      </Text>
                    </TouchableOpacity>
                  )}
                </Card.Content>
              </Card>
            );
          })}

        {/* Etat vide */}
        {!loading && currentList.length === 0 && (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="cash-remove"
              size={56}
              color="#94a3b8"
            />
            <Text style={styles.emptyTitle}>Aucun paiement</Text>
            <Text style={styles.emptySub}>
              Aucun resultat pour la periode selectionnee
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  hero: { backgroundColor: '#081648', padding: 20, paddingBottom: 24 },
  heroLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 12,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroStatLbl: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 },
  heroStatSep: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  offlineBanner: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  offlineTxt: { color: '#92400e', fontSize: 12 },
  body: { padding: 12, gap: 8 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  chipSm: { paddingHorizontal: 10, paddingVertical: 5 },
  chipActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  chipTxt: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  chipTxtSm: { fontSize: 11 },
  chipTxtActive: { color: '#fff' },
  card: { borderRadius: 16, marginBottom: 8, backgroundColor: '#fff' },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  cardSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  cardAmt: { fontSize: 16, fontWeight: '800', color: '#1a56db' },
  badgeAnnule: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '700',
    marginTop: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
  },
  cancelBtnTxt: { fontSize: 13, color: '#dc2626', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
  },
});
