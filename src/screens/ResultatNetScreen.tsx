import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getRapportMois, getDepenses } from '../services/api.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

export default function ResultatNetScreen() {
  const { lang } = useLang();
  const [rapport, setRapport] = useState<any>(null);
  const [depenses, setDepenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const charger = async () => {
    setLoading(true);
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
      const [r, d] = await Promise.all([getRapportMois(), getDepenses()]);
      const rapportData = r.data?.data || r.data;
      const deps = d.data?.data || d.data || [];
      const mois = new Date().getMonth();
      const annee = new Date().getFullYear();
      const depensesFiltrees = deps.filter((dep: any) => {
        if (!dep.date) return true;
        const dt = new Date(dep.date);
        return dt.getMonth() === mois && dt.getFullYear() === annee;
      });
      setRapport(rapportData);
      setDepenses(depensesFiltrees);
      setFromCache(false);
      AsyncStorage.setItem(
        'cache_resultat_net',
        JSON.stringify({ rapport: rapportData, depenses: depensesFiltrees }),
      ).catch(() => {});
    } catch {
      try {
        const s = await AsyncStorage.getItem('cache_resultat_net');
        if (s) {
          const cached = JSON.parse(s);
          setRapport(cached.rapport);
          setDepenses(cached.depenses || []);
          setFromCache(true);
        }
      } catch {}
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const ca = rapport?.chiffreAffaireTotal || 0;
  const beneficeBrut = rapport?.beneficeTotal || 0;
  const totalDepenses = depenses.reduce((s: number, d: any) => s + (d.montant || 0), 0);
  const resultatNet = beneficeBrut - totalDepenses;

  if (loading && !refreshing) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
          />
        }
      >
        {/* Hero banner */}
        <View style={styles.hero}>
          <View style={styles.heroStat}>
            <Text style={styles.heroVal} numberOfLines={1} adjustsFontSizeToFit>
              {ca.toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.heroLbl}>CA Mois (FCFA)</Text>
          </View>
          <View style={styles.heroSep} />
          <View style={styles.heroStat}>
            <Text style={styles.heroVal} numberOfLines={1} adjustsFontSizeToFit>
              {totalDepenses.toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.heroLbl}>Charges (FCFA)</Text>
          </View>
          <View style={styles.heroSep} />
          <View style={styles.heroStat}>
            <Text
              style={[styles.heroVal, { color: resultatNet >= 0 ? '#4ade80' : '#f87171' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {resultatNet.toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.heroLbl}>Résultat net (FCFA)</Text>
          </View>
        </View>

        {/* Bandeau offline */}
        {fromCache && (
          <View style={styles.offlineBanner}>
            <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
            <Text style={styles.offlineTxt}>Mode hors ligne — données locales</Text>
          </View>
        )}

        {/* Card synthèse calcul */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Calcul du résultat</Text>

            <View style={styles.detailRow}>
              <View style={[styles.avatar, { backgroundColor: '#1a56db22' }]}>
                <MaterialCommunityIcons name="cash-multiple" size={22} color="#1a56db" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{tr('chiffre_affaires', lang)}</Text>
              </View>
              <Text style={[styles.cardAmt, { color: '#16a34a' }]}>{ca.toLocaleString('fr-FR')} F</Text>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.avatar, { backgroundColor: '#1a56db22' }]}>
                <MaterialCommunityIcons name="trending-up" size={22} color="#1a56db" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{tr('benefice_brut', lang)}</Text>
              </View>
              <Text style={[styles.cardAmt, { color: '#16a34a' }]}>{beneficeBrut.toLocaleString('fr-FR')} F</Text>
            </View>

            <Divider style={{ marginVertical: 8 }} />

            <View style={styles.detailRow}>
              <View style={[styles.avatar, { backgroundColor: '#dc262622' }]}>
                <MaterialCommunityIcons name="minus-circle" size={22} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{tr('total', lang)} {tr('depenses', lang)}</Text>
              </View>
              <Text style={[styles.cardAmt, { color: '#dc2626' }]}>
                - {totalDepenses.toLocaleString('fr-FR')} F
              </Text>
            </View>

            <Divider style={{ marginVertical: 8 }} />

            <View style={styles.detailRow}>
              <View style={[styles.avatar, { backgroundColor: resultatNet >= 0 ? '#16a34a22' : '#dc262622' }]}>
                <MaterialCommunityIcons
                  name={resultatNet >= 0 ? 'check-circle' : 'alert-circle'}
                  size={22}
                  color={resultatNet >= 0 ? '#16a34a' : '#dc2626'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { fontWeight: 'bold' }]}>{tr('resultat_net', lang)}</Text>
              </View>
              <Text style={[styles.cardAmt, { color: resultatNet >= 0 ? '#16a34a' : '#dc2626', fontSize: 16 }]}>
                {resultatNet.toLocaleString('fr-FR')} F
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Liste des dépenses du mois */}
        {depenses.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Dépenses du mois ({depenses.length})</Text>
            {depenses.map((dep, i) => (
              <Card key={dep.id ?? i} style={styles.card}>
                <Card.Content style={styles.cardRow}>
                  <View style={[styles.avatar, { backgroundColor: '#dc262622' }]}>
                    <MaterialCommunityIcons name="cash-minus" size={22} color="#dc2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{dep.libelle || dep.motif || 'Dépense'}</Text>
                    <Text style={styles.cardSub}>
                      {dep.date ? new Date(dep.date).toLocaleDateString('fr-FR') : '—'}
                      {dep.categorie ? ` · ${dep.categorie}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.cardAmt, { color: '#dc2626' }]}>
                    {(dep.montant || 0).toLocaleString('fr-FR')} F
                  </Text>
                </Card.Content>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  hero: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2, textAlign: 'center' },
  heroSep: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12 },
  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12, elevation: 1 },
  sectionTitle: { fontWeight: 'bold', color: '#1a56db', marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  cardSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  cardAmt: { fontWeight: '700', color: '#081648', fontSize: 14 },
});
