import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getVentesParVendeur } from '../services/api.service';
import { sauvegarderCache, lireCache } from '../services/offline.service';
import { useColors } from '../theme/colors';

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
  return (n || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' F CFA';
}

function formatDate(iso: string): string {
  const [annee, mois, jour] = iso.split('-');
  return `${jour}/${mois}/${annee}`;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const CLE_CACHE = 'historique_vendeur_lignes';

function agregerParVendeur(lignes: VenteParVendeurJour[]): VendeurResume[] {
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
  return Array.from(parVendeur.values()).sort((a, b) => b.caTotal - a.caTotal);
}

export default function HistoriqueVendeurScreen() {
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');
  const [vendeurs, setVendeurs] = useState<VendeurResume[]>([]);
  const [selectionne, setSelectionne] = useState<VendeurResume | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const charger = () => {
    setLoading(true);
    setErreur('');
    const fin = new Date();
    const debut = new Date();
    debut.setDate(debut.getDate() - 29);

    getVentesParVendeur(toIso(debut), toIso(fin))
      .then(res => {
        const lignes: VenteParVendeurJour[] = res.data || [];
        const liste = agregerParVendeur(lignes);
        setVendeurs(liste);
        setSelectionne(liste[0] || null);
        setFromCache(false);
        sauvegarderCache(CLE_CACHE, lignes).catch(() => {});
      })
      .catch(async () => {
        const lignesCache = await lireCache<VenteParVendeurJour>(CLE_CACHE);
        if (lignesCache.length > 0) {
          const liste = agregerParVendeur(lignesCache);
          setVendeurs(liste);
          setSelectionne(liste[0] || null);
          setFromCache(true);
        } else {
          setErreur("Impossible de charger l'historique des ventes par vendeur.");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    charger();
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (erreur) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, gap: 10 }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={40} color={colors.danger} />
        <Text style={{ color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 24 }}>{erreur}</Text>
      </View>
    );
  }

  if (!vendeurs.length) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, gap: 10 }]}>
        <MaterialCommunityIcons name="chart-line" size={44} color={colors.placeholder} />
        <Text style={{ color: colors.textSecondary }}>Aucune vente trouvée sur cette période.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.chipsRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}
      >
        {vendeurs.map(v => {
          const actif = selectionne?.vendeurId === v.vendeurId;
          return (
            <TouchableOpacity
              key={v.vendeurId}
              style={[
                styles.chip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                actif && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setSelectionne(v)}>
              <Text style={[styles.chipText, { color: colors.textSecondary }, actif && styles.chipTextActive]}>
                {v.vendeurNom}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectionne && (
        <ScrollView contentContainerStyle={{ padding: 14 }}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Comptant</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{selectionne.nbVentesComptant}</Text>
              <Text style={[styles.summarySub, { color: colors.textSecondary }]}>{formatPrice(selectionne.caComptant)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Crédit</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{selectionne.nbVentesCredit}</Text>
              <Text style={[styles.summarySub, { color: colors.textSecondary }]}>{formatPrice(selectionne.caCredit)}</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardTotal, { backgroundColor: colors.primary, borderColor: colors.primary, shadowColor: colors.primary }]}>
              <Text style={[styles.summaryLabel, { color: '#fff' }]}>Total</Text>
              <Text style={[styles.summaryValue, { color: '#fff' }]}>{selectionne.nbVentesTotal}</Text>
              <Text style={[styles.summarySub, { color: '#e0e7ff' }]}>{formatPrice(selectionne.caTotal)}</Text>
            </View>
          </View>

          {selectionne.jours.map(j => (
            <View key={j.date} style={[styles.jourCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.jourHead}>
                <Text style={[styles.jourDate, { color: colors.text }]}>{formatDate(j.date)}</Text>
                <Text style={[styles.jourTotal, { color: colors.primary }]}>{formatPrice(j.caTotal)}</Text>
              </View>
              <Text style={[styles.jourDetail, { color: colors.textSecondary }]}>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#f97316', paddingHorizontal: 12, paddingVertical: 6 },
  offlineBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  chipsRow: { flexGrow: 0, paddingVertical: 10, borderBottomWidth: 1 },
  chip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  // STYLE (2026-08-16) : coins plus arrondis + ombre douce (avant : juste une
  // bordure fine, look plat) pour un rendu plus premium.
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  summaryCardTotal: {
    elevation: 3, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  summaryValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  summarySub: { fontSize: 12, marginTop: 2 },
  jourCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  jourHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jourDate: { fontSize: 14, fontWeight: '700' },
  jourTotal: { fontSize: 14, fontWeight: '800' },
  jourDetail: { fontSize: 12, marginTop: 6 },
});
