import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Linking, Alert } from 'react-native';
import { Text, Card, Button, ActivityIndicator } from 'react-native-paper';
import { getVentes } from '../services/api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { imprimerFactureRN, partagerFactureRN, DesignFacture } from '../services/invoice.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

export default function FacturesScreen() {
  const { lang } = useLang();
  const [ventes, setVentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [boutique, setBoutique] = useState<any>({});
  const [design, setDesign] = useState<DesignFacture>(1);

  const charger = async () => {
    const raw = await AsyncStorage.getItem('boutique_info');
    if (raw) setBoutique(JSON.parse(raw));
    const tpl = await AsyncStorage.getItem('facture_template');
    if (tpl === 'moderne') setDesign(2);
    else if (tpl === 'minimaliste') setDesign(3);
    else setDesign(1);
    const net = await NetInfo.fetch();
    try {
      if (!net.isConnected) throw new Error('offline');
      const res = await getVentes();
      const liste = res.data?.data || res.data || [];
      setVentes(liste);
      setFromCache(false);
      AsyncStorage.setItem('cache_factures', JSON.stringify(liste)).catch(() => {});
    } catch {
      try {
        const s = await AsyncStorage.getItem('cache_factures');
        if (s) { setVentes(JSON.parse(s)); setFromCache(true); } else setFromCache(false);
      } catch { setFromCache(false); }
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const buildInvoiceData = (vente: any) => ({
    numero: vente.numeroVente || `#${vente.id}`,
    date: vente.dateVente,
    clientNom: vente.clientNom,
    clientPrenom: vente.clientPrenom,
    clientTelephone: vente.clientTelephone,
    vendeurNom: vente.vendeurNom,
    modePaiement: vente.modePaiement,
    referencePaiement: vente.referencePaiement,
    estCredit: vente.estCredit,
    creditRegle: vente.creditRegle,
    montantVerse: vente.montantVerse,
    montantRestant: vente.montantRestant,
    dateEcheance: vente.dateEcheance,
    lignes: vente.lignes || vente.produits || [],
    montantTotal: vente.montantTotal,
    montantApresRemise: vente.montantApresRemise,
    montantRemiseTotal: vente.montantRemiseTotal,
    id: vente.id,
    type: 'VENTE' as const,
  });

  const handleImprimer = async (vente: any) => {
    try {
      await imprimerFactureRN(buildInvoiceData(vente), boutique, design);
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e?.message || 'Impossible d\'imprimer');
    }
  };

  const handlePartager = async (vente: any) => {
    try {
      await partagerFactureRN(buildInvoiceData(vente), boutique, design);
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e?.message || 'Impossible de partager');
    }
  };

  const envoyerWhatsApp = (vente: any) => {
    const lignes = vente.lignes?.map((l: any) => `  - ${l.produitNom} x${l.quantite} = ${l.sousTotal?.toLocaleString('fr-FR')} FCFA`).join('\n') || '';
    const message = [
      `🧾 *FACTURE — ${boutique.nom || 'Boutique'}*`,
      `Client : ${vente.clientNom || 'Anonyme'}`,
      `Date : ${vente.dateVente ? new Date(vente.dateVente).toLocaleDateString('fr-FR') : ''}`,
      ``,
      lignes,
      ``,
      `*Total : ${vente.montantTotal?.toLocaleString('fr-FR')} FCFA*`,
      `Paiement : ${vente.modePaiement?.replace('_', ' ')}`,
    ].join('\n');
    const num = boutique.telephone?.replace(/[\s()\-+]/g, '') || '';
    if (num) Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(message)}`);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      {fromCache && (
        <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ color: '#92400e', fontSize: 12 }}>⚠ Mode hors ligne — données locales</Text>
        </View>
      )}
      <FlatList
        data={ventes}
        keyExtractor={v => String(v.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium">{item.numeroVente || `${tr('factures', lang)} #${item.id}`}</Text>
                <Text style={styles.montant}>{item.montantTotal?.toLocaleString('fr-FR')} FCFA</Text>
              </View>
              <Text style={styles.sub}>{item.clientNom || 'Client anonyme'}</Text>
              <Text style={styles.date}>{item.dateVente ? new Date(item.dateVente).toLocaleDateString('fr-FR') : ''}</Text>
              {item.estCredit && (
                <View style={styles.creditBadge}>
                  <Text style={styles.creditText}>{tr('credits', lang)} — {tr('reste_a_payer', lang)} : {item.montantRestant?.toLocaleString('fr-FR')} FCFA</Text>
                </View>
              )}
            </Card.Content>
            <Card.Actions style={styles.actions}>
              <Button icon="printer" mode="contained" compact onPress={() => handleImprimer(item)} style={styles.btnPrint}>
                {tr('imprimer', lang)}
              </Button>
              <Button icon="share-variant" compact onPress={() => handlePartager(item)}>
                PDF
              </Button>
              <Button icon="whatsapp" onPress={() => envoyerWhatsApp(item)} textColor="#25D366" compact>
                WA
              </Button>
            </Card.Actions>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{tr('aucune_facture', lang)}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  card: { marginBottom: 10, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  montant: { fontWeight: 'bold', color: '#1a56db', fontSize: 16 },
  sub: { color: '#666', marginTop: 4 },
  date: { color: '#aaa', fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  creditBadge: { marginTop: 6, backgroundColor: '#fff7ed', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  creditText: { fontSize: 12, color: '#d97706', fontWeight: '700' },
  actions: { flexWrap: 'wrap', paddingHorizontal: 8 },
  btnPrint: { backgroundColor: '#1a56db' },
});
