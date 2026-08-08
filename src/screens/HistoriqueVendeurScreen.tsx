import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { getVentesParVendeur } from '../services/api.service';

const BLUE = '#1a56db';

interface VenteParVendeurJour {
  vendeurId: number;
  vendeurNom: string;
  date: string;
  nbVentesComptant: number;
  nbVentesCredit: number;
  caComptant: number;
  caCredit: number;
  caTotal: number;
  nbVentesTotal: number;
}

interface VendeurResume {
  vendeurId: number;
  vendeurNom: string;
  nbVentesComptant: number;
  nbVentesCredit: number;
  caComptant: number;
  caCredit: number;
  caTotal: number;
  nbVentesTotal: number;
  jours: VenteParVendeurJour[];
}

function formatPrice(n: number): string {
  return (n || 0).toLocaleString('fr-FR') + ' F CFA';
}

function formatDate(iso: string): string {
  const [annee, mois, jour] = iso.split('-');
  return `${jour}/${mois}/${annee}`;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function HistoriqueVendeurScreen() {
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');
  const [vendeurs, setVendeurs] = useState<VendeurResume[]>([]);
  const [selectionne, setSelectionne] = useState<VendeurResume | null>(null);

  const charger = () => {
    setLoading(true);
    setErreur('');
    const fin = new Date();
    const debut = new Date();
    debut.setDate(debut.getDate() - 29);

    getVentesParVendeur(toIso(debut), toIso(fin))
      .then(res => {
        const lignes: VenteParVendeurJour[] = res.data || [];
        const parVendeur = new Map<number, VendeurResume>();

        for (const ligne of lignes) {
          let resume = parVendeur.get(ligne.vendeurId);
          if (!resume) {
            resume = {
              vendeurId: ligne.vendeurId,
              vendeurNom: ligne.vendeurNom,
              nbVentesComptant: 0,
              nbVentesCredit: 0,
              caComptant: 0,
              caCredit: 0,
              caTotal: 0,
              nbVentesTotal: 0,
              jours: [],
            };
            parVendeur.set(ligne.vendeurId, resume);
          }
          resume.nbVentesComptant += ligne.nbVentesComptant;
          resume.nbVentesCredit += ligne.nbVentesCredit;
          resume.caComptant += ligne.caComptant;
          resume.caCredit += ligne.caCredit;
          resume.caTotal += ligne.caTotal;
          resume.nbVentesTotal += ligne.nbVentesTotal;
          resume.jours.push(ligne);
        }

        const liste = Array.from(parVendeur.values()).sort((a, b) => b.caTotal - a.caTotal);
        setVendeurs(liste);
        setSelectionne(liste[0] || null);
      })
      .catch(() => setErreur("Impossible de charger l'historique des ventes par vendeur."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    charger();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  if (erreur) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#dc2626' }}>{erreur}</Text>
      </View>
    );
  }

  if (!vendeurs.length) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#94a3b8' }}>Aucune vente trouvée sur cette période.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
        {vendeurs.map(v => (
          <TouchableOpacity
            key={v.vendeurId}
            style={[styles.chip, selectionne?.vendeurId === v.vendeurId && styles.chipActive]}
            onPress={() => setSelectionne(v)}>
            <Text style={[styles.chipText, selectionne?.vendeurId === v.vendeurId && styles.chipTextActive]}>
              {v.vendeurNom}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {selectionne && (
        <ScrollView contentContainerStyle={{ padding: 14 }}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Comptant</Text>
              <Text style={styles.summaryValue}>{selectionne.nbVentesComptant}</Text>
              <Text style={styles.summarySub}>{formatPrice(selectionne.caComptant)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Crédit</Text>
              <Text style={styles.summaryValue}>{selectionne.nbVentesCredit}</Text>
              <Text style={styles.summarySub}>{formatPrice(selectionne.caCredit)}</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardTotal]}>
              <Text style={[styles.summaryLabel, { color: '#fff' }]}>Total</Text>
              <Text style={[styles.summaryValue, { color: '#fff' }]}>{selectionne.nbVentesTotal}</Text>
              <Text style={[styles.summarySub, { color: '#e0e7ff' }]}>{formatPrice(selectionne.caTotal)}</Text>
            </View>
          </View>

          {selectionne.jours.map(j => (
            <View key={j.date} style={styles.jourCard}>
              <View style={styles.jourHead}>
                <Text style={styles.jourDate}>{formatDate(j.date)}</Text>
                <Text style={styles.jourTotal}>{formatPrice(j.caTotal)}</Text>
              </View>
              <Text style={styles.jourDetail}>
                Comptant : {j.nbVentesComptant} ({formatPrice(j.caComptant)}) — Crédit : {j.nbVentesCredit} ({formatPrice(j.caCredit)})
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  chipsRow: { flexGrow: 0, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  chip: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  chipActive: { borderColor: BLUE, backgroundColor: BLUE },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryCardTotal: { backgroundColor: BLUE, borderColor: BLUE },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  summarySub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  jourCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  jourHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jourDate: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  jourTotal: { fontSize: 14, fontWeight: '800', color: BLUE },
  jourDetail: { fontSize: 12, color: '#64748b', marginTop: 6 },
});
