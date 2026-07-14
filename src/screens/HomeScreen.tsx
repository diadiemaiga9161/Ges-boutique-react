import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Text,
  Card,
  ActivityIndicator,
  Divider,
  SegmentedButtons,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api.service';
import { getNombreOperationsPending } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

interface RapportStats {
  chiffreAffaires?: number;
  chiffreAffaireTotal?: number;
  nombreVentes?: number;
  totalCredits?: number;
  montantCreditsNonRegles?: number;
}

type Periode = 'jour' | 'semaine' | 'mois';

const PERIODE_LABELS: Record<Periode, string> = {
  jour: "Aujourd'hui",
  semaine: 'Cette semaine',
  mois: 'Ce mois',
};

export default function HomeScreen() {
  const { lang } = useLang();
  const navigation = useNavigation<any>();

  const [user, setUser] = useState<any>(null);
  const [boutique, setBoutique] = useState<any>({});
  const [pendingCount, setPendingCount] = useState(0);
  const [periode, setPeriode] = useState<Periode>('jour');
  const [rapport, setRapport] = useState<RapportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ventes, setVentes] = useState<any[]>([]);
  const [alertes, setAlertes] = useState<any[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => { if (raw) setUser(JSON.parse(raw)); });
    AsyncStorage.getItem('boutique_info').then(raw => { if (raw) setBoutique(JSON.parse(raw)); });
    getNombreOperationsPending().then(setPendingCount);
    charger('jour');
  }, []);

  const charger = useCallback(async (p: Periode) => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      let rapportRes;
      if (p === 'jour') rapportRes = await api.get('/rapports/jour', { params: { date: today } });
      else if (p === 'semaine') rapportRes = await api.get('/rapports/semaine');
      else rapportRes = await api.get('/rapports/mois');
      setRapport(rapportRes.data?.data || rapportRes.data || null);
    } catch { setRapport(null); }

    try {
      const vRes = await api.get('/ventes/jour', { params: { limite: 5 } });
      const raw = vRes.data?.data || vRes.data;
      setVentes(Array.isArray(raw) ? raw.slice(0, 5) : []);
    } catch { setVentes([]); }

    try {
      const nRes = await api.get('/notifications');
      const rawN = nRes.data?.data || nRes.data;
      setAlertes(Array.isArray(rawN) ? rawN.filter((n: any) => n.type === 'STOCK_BAS' || n.stockActuel != null) : []);
    } catch { setAlertes([]); }

    setLoading(false);
    setRefreshing(false);
  }, []);

  const switchPeriode = (p: Periode) => {
    setPeriode(p);
    charger(p);
  };

  const money = (v?: number) =>
    `${((v) || 0).toLocaleString('fr-FR')} ${boutique.devise || 'FCFA'}`;

  const ca = rapport?.chiffreAffaireTotal ?? rapport?.chiffreAffaires ?? 0;
  const nbVentes = rapport?.nombreVentes ?? 0;
  const creditsNonRegles = rapport?.montantCreditsNonRegles ?? rapport?.totalCredits ?? 0;
  const nbAlertes = alertes.length;

  const dateAujourdhui = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const nomAffiche = user
    ? [user.prenom, user.nom].filter(Boolean).join(' ') || user.username || 'Utilisateur'
    : 'Utilisateur';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); charger(periode); }}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour, {nomAffiche}</Text>
          <Text style={styles.boutiqueName}>{boutique.nom || 'Ma boutique'}</Text>
          <Text style={styles.dateText}>{dateAujourdhui}</Text>
        </View>
      </View>

      {/* Bandeau sync */}
      {pendingCount > 0 && (
        <View style={styles.syncBanner}>
          <MaterialCommunityIcons name="cloud-sync" size={14} color="#1e40af" />
          <Text style={styles.syncTxt}>{pendingCount} opération{pendingCount > 1 ? 's' : ''} en attente de synchronisation</Text>
        </View>
      )}

      {/* Sélecteur période */}
      <SegmentedButtons
        value={periode}
        onValueChange={v => switchPeriode(v as Periode)}
        buttons={[
          { value: 'jour', label: "Auj." },
          { value: 'semaine', label: 'Semaine' },
          { value: 'mois', label: 'Mois' },
        ]}
        style={styles.segments}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      ) : (
        <>
          {/* Grille 4 stats */}
          <View style={styles.grid}>
            <View style={[styles.statCard, styles.statBlue]}>
              <Text style={styles.statLabel}>{tr('chiffre_affaires', lang)}</Text>
              <Text style={styles.statVal}>{money(ca)}</Text>
              <Text style={styles.statPeriode}>{PERIODE_LABELS[periode]}</Text>
            </View>

            <View style={[styles.statCard, styles.statGreen]}>
              <Text style={styles.statLabel}>Nb ventes</Text>
              <Text style={styles.statVal}>{nbVentes}</Text>
              <Text style={styles.statPeriode}>{PERIODE_LABELS[periode]}</Text>
            </View>

            <View style={[styles.statCard, styles.statOrange]}>
              <Text style={styles.statLabel}>Crédits restants</Text>
              <Text style={styles.statVal}>{money(creditsNonRegles)}</Text>
              <Text style={styles.statPeriode}>Non réglés</Text>
            </View>

            <View style={[styles.statCard, nbAlertes > 0 ? styles.statRed : styles.statGray]}>
              <Text style={styles.statLabel}>Alertes stock</Text>
              <Text style={styles.statVal}>{nbAlertes}</Text>
              <Text style={styles.statPeriode}>{nbAlertes > 0 ? 'produits' : 'Aucune alerte'}</Text>
            </View>
          </View>

          {/* Ventes récentes */}
          {ventes.length > 0 && (
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Ventes récentes
                </Text>
                {ventes.map((v: any, i: number) => (
                  <View key={v.id || i}>
                    <View style={styles.venteRow}>
                      <View>
                        <Text style={styles.venteHeure}>
                          {v.date
                            ? new Date(v.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                            : v.heure || '—'}
                        </Text>
                        <Text style={[
                          styles.venteBadge,
                          { color: v.estCredit ? '#ff9800' : '#4caf50' },
                        ]}>
                          {v.estCredit ? 'Crédit' : 'Comptant'}
                        </Text>
                      </View>
                      <Text style={styles.venteMontant}>{money(v.montantTotal ?? v.total)}</Text>
                    </View>
                    {i < ventes.length - 1 && <Divider />}
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}

          {/* Alertes stock */}
          {alertes.length > 0 && (
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={[styles.cardTitle, { color: '#e53935' }]}>
                  Alertes stock
                </Text>
                {alertes.slice(0, 5).map((a: any, i: number) => (
                  <View key={a.id || i}>
                    <View style={styles.alerteRow}>
                      <Text style={styles.alerteNom}>{a.produitNom || a.nom || a.message || '—'}</Text>
                      <View style={styles.alerteRight}>
                        <Text style={styles.alerteStock}>
                          Stock : {a.stockActuel ?? a.quantiteActuelle ?? '—'}
                        </Text>
                        {(a.seuilAlerte ?? a.seuil) != null && (
                          <Text style={styles.alerteSeuil}>
                            Seuil : {a.seuilAlerte ?? a.seuil}
                          </Text>
                        )}
                      </View>
                    </View>
                    {i < Math.min(alertes.length, 5) - 1 && <Divider />}
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}

          {/* Boutons rapides */}
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: '#1a56db' }]}
              onPress={() => navigation.navigate('Tabs', { screen: 'Vente' })}
            >
              <Text style={styles.quickBtnIcon}>🛒</Text>
              <Text style={styles.quickBtnLabel}>Faire une vente</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: '#ff9800' }]}
              onPress={() => navigation.navigate('Credits')}
            >
              <Text style={styles.quickBtnIcon}>💳</Text>
              <Text style={styles.quickBtnLabel}>Voir les crédits</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: '#4caf50' }]}
              onPress={() => navigation.navigate('Inventaire')}
            >
              <Text style={styles.quickBtnIcon}>📦</Text>
              <Text style={styles.quickBtnLabel}>Inventaire</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Sync banner
  syncBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 6 },
  syncTxt: { color: '#1e40af', fontSize: 12 },

  // Header
  header: {
    backgroundColor: '#081648',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
  },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  boutiqueName: { color: '#fff', fontWeight: 'bold', fontSize: 20, marginTop: 2 },
  dateText: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 4, textTransform: 'capitalize' },

  // Sélecteur
  segments: { margin: 12 },

  // Grille stats 2x2
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    gap: 10,
    marginBottom: 4,
  },
  statCard: {
    width: '47%',
    borderRadius: 14,
    padding: 16,
    marginBottom: 2,
    elevation: 2,
  },
  statBlue:   { backgroundColor: '#1a56db' },
  statGreen:  { backgroundColor: '#4caf50' },
  statOrange: { backgroundColor: '#ff9800' },
  statRed:    { backgroundColor: '#e53935' },
  statGray:   { backgroundColor: '#78909c' },
  statLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  statVal:   { color: '#fff', fontWeight: 'bold', fontSize: 17, marginTop: 6, marginBottom: 2 },
  statPeriode: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },

  // Cards
  card: { marginHorizontal: 12, marginBottom: 12, borderRadius: 12 },
  cardTitle: { fontWeight: 'bold', color: '#1a56db', marginBottom: 10 },

  // Ventes
  venteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  venteHeure: { fontSize: 13, color: '#444' },
  venteBadge: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  venteMontant: { fontWeight: 'bold', fontSize: 15, color: '#333' },

  // Alertes
  alerteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  alerteNom: { flex: 1, fontSize: 13, color: '#333' },
  alerteRight: { alignItems: 'flex-end' },
  alerteStock: { color: '#e53935', fontWeight: 'bold', fontSize: 12 },
  alerteSeuil: { color: '#aaa', fontSize: 11 },

  // Boutons rapides
  sectionTitle: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 10,
    fontWeight: 'bold',
    color: '#444',
    fontSize: 15,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
  },
  quickBtn: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 2,
  },
  quickBtnIcon: { fontSize: 22, marginBottom: 6 },
  quickBtnLabel: { color: '#fff', fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
});
