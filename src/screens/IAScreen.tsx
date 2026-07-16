import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  analyserIA,
  enregistrerFeedbackIA,
  getProfilIA,
  sauvegarderProfilIA,
} from '../services/api.service';
import type { AnalyseIAResult, ProfilIA } from '../types';

const DARK = '#081648';
const BLUE = '#1a56db';
const { width: SW } = Dimensions.get('window');

// ─── Données Wizard ──────────────────────────────────────────────────────────

const TYPES_BOUTIQUE = [
  { value: 'ALIMENTATION', label: 'Alimentation' },
  { value: 'TEXTILE', label: 'Textile' },
  { value: 'ELECTRONIQUE', label: 'Electronique' },
  { value: 'PHARMACIE', label: 'Pharmacie' },
  { value: 'MIXTE', label: 'Mixte' },
  { value: 'AUTRE', label: 'Autre' },
];

const JOURS_SEMAINE = [
  { value: 'LUNDI',    label: 'Lun' },
  { value: 'MARDI',    label: 'Mar' },
  { value: 'MERCREDI', label: 'Mer' },
  { value: 'JEUDI',    label: 'Jeu' },
  { value: 'VENDREDI', label: 'Ven' },
  { value: 'SAMEDI',   label: 'Sam' },
];

const OBJECTIFS_STOCK = [7, 14, 21, 30, 45, 60];
const MARGES_OBJECTIF = [10, 15, 20, 25, 30, 40, 50];
const DELAIS_CREDIT = [7, 15, 30, 45, 60];

// ─── Segments RFM ────────────────────────────────────────────────────────────

const SEGMENTS_RFM: {
  key: string;
  label: string;
  description: string;
  color: string;
  icon: string;
}[] = [
  { key: 'CHAMPIONS', label: 'Champions', description: 'Meilleurs clients', color: '#f59e0b', icon: 'medal' },
  { key: 'LOYAUX', label: 'Loyaux', description: 'Clients fideles', color: '#10b981', icon: 'heart' },
  { key: 'POTENTIELS', label: 'Potentiels', description: 'A developper', color: '#3b82f6', icon: 'trending-up' },
  { key: 'A_RISQUE', label: 'A risque', description: 'A recuperer', color: '#f97316', icon: 'alert-circle' },
  { key: 'ENDORMIS', label: 'Endormis', description: 'Clients perdus', color: '#ef4444', icon: 'weather-night' },
  { key: 'NOUVEAUX', label: 'Nouveaux', description: 'Clients recents', color: '#8b5cf6', icon: 'star' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function tendanceInfo(t: string): { icon: string; color: string; label: string } {
  switch (t) {
    case 'FORTE_HAUSSE': return { icon: 'trending-up', color: '#10b981', label: 'Forte hausse' };
    case 'HAUSSE': return { icon: 'arrow-up', color: '#34d399', label: 'Hausse' };
    case 'STABLE': return { icon: 'minus', color: '#60a5fa', label: 'Stable' };
    case 'BAISSE': return { icon: 'arrow-down', color: '#fb923c', label: 'Baisse' };
    case 'FORTE_BAISSE': return { icon: 'trending-down', color: '#ef4444', label: 'Forte baisse' };
    default: return { icon: 'minus', color: '#9ca3af', label: t || 'Inconnu' };
  }
}

function prioriteStyle(p: string): { bg: string; text: string } {
  switch (p) {
    case 'CRITIQUE': return { bg: '#fef2f2', text: '#dc2626' };
    case 'HAUTE': return { bg: '#fff7ed', text: '#ea580c' };
    case 'MOYENNE': return { bg: '#eff6ff', text: '#2563eb' };
    default: return { bg: '#f9fafb', text: '#6b7280' };
  }
}

function fmt(n: number): string {
  if (!n && n !== 0) return '—';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' Ar';
}

const PROFIL_INITIAL: ProfilIA = {
  typeBoutique: '',
  joursApprovisionnement: [] as string[],
  objectifStockJours: 30,
  margeObjectif: 20,
  delaiReglementCredit: 30,
};

// ─── Composant principal ─────────────────────────────────────────────────────

export default function IAScreen() {
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyse, setAnalyse] = useState<AnalyseIAResult | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Wizard
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [profil, setProfil] = useState<ProfilIA>({ ...PROFIL_INITIAL });
  const [savingProfil, setSavingProfil] = useState(false);

  // Recommandations traitees
  const [traitees, setTraitees] = useState<Set<string>>(new Set());

  // ── Chargement ──────────────────────────────────────────────────────────

  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      await getProfilIA();
    } catch (e: any) {
      if (e?.response?.status === 404) {
        // Pas encore de profil : afficher le wizard
        setShowWizard(true);
        setLoading(false);
        return;
      }
      // Autre erreur reseau : on continue quand meme pour tenter l'analyse
    }

    try {
      const res = await analyserIA();
      const data: AnalyseIAResult = res.data?.data || res.data;
      setAnalyse(data);
    } catch (e: any) {
      const msg =
        e?.response?.data?.erreur ||
        e?.response?.data?.message ||
        e?.message ||
        'Impossible de charger l\'analyse IA. Verifiez la connexion.';
      setErreur(msg);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // ── Wizard ───────────────────────────────────────────────────────────────

  const wizardSuivant = () => {
    if (wizardStep === 0 && !profil.typeBoutique) {
      Alert.alert('Attention', 'Veuillez choisir un type de boutique.');
      return;
    }
    if (wizardStep < 4) {
      setWizardStep(s => s + 1);
    }
  };

  const terminerWizard = async () => {
    setSavingProfil(true);
    try {
      // joursApprovisionnement envoyé en chaîne JSON comme attendu par le backend
      const payload = {
        ...profil,
        joursApprovisionnement: JSON.stringify(profil.joursApprovisionnement),
      };
      await sauvegarderProfilIA(payload);
      setShowWizard(false);
      setWizardStep(0);
      charger();
    } catch (e: any) {
      const msg =
        e?.response?.data?.erreur ||
        e?.response?.data?.message ||
        e?.message ||
        'Impossible de sauvegarder le profil IA. Reessayez.';
      Alert.alert('Erreur', msg);
    }
    setSavingProfil(false);
  };

  const toggleJour = (val: string) => {
    setProfil(p => ({
      ...p,
      joursApprovisionnement: p.joursApprovisionnement.includes(val)
        ? p.joursApprovisionnement.filter(v => v !== val)
        : [...p.joursApprovisionnement, val],
    }));
  };

  // ── Recommandations ───────────────────────────────────────────────────────

  const feedbackReco = async (id: string, statut: 'SUIVIE' | 'IGNOREE') => {
    // Marquer visuellement en premier
    setTraitees(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      await enregistrerFeedbackIA(id, statut);
    } catch {
      // Silencieux : deja marque visuellement
    }
  };

  // ── Rendu : Wizard ────────────────────────────────────────────────────────

  const renderWizard = () => {
    const progressPct = Math.round((wizardStep / 4) * 100);
    const isLast = wizardStep === 4;

    return (
      <Modal visible={showWizard} animationType="slide" statusBarTranslucent>
        <View style={styles.wizardRoot}>
          {/* En-tete */}
          <View style={styles.wizardHeader}>
            <MaterialCommunityIcons name="robot-excited-outline" size={36} color="#93c5fd" />
            <Text style={styles.wizardTitle}>Configurer votre IA</Text>
            <Text style={styles.wizardStepLabel}>Etape {wizardStep + 1} sur 5</Text>
          </View>

          {/* Barre de progression */}
          <View style={styles.progressOuter}>
            <View style={[styles.progressInner, { width: `${progressPct}%` as any }]} />
          </View>

          {/* Contenu de l'etape */}
          <ScrollView
            contentContainerStyle={styles.wizardContent}
            keyboardShouldPersistTaps="handled"
          >
            {wizardStep === 0 && (
              <>
                <Text style={styles.wizardQuestion}>Quel type de boutique ?</Text>
                <View style={styles.optionsGrid}>
                  {TYPES_BOUTIQUE.map(t => {
                    const sel = profil.typeBoutique === t.value;
                    return (
                      <TouchableOpacity
                        key={t.value}
                        style={[styles.optionBtn, sel && styles.optionBtnSel]}
                        onPress={() => setProfil(p => ({ ...p, typeBoutique: t.value }))}
                      >
                        <Text style={[styles.optionBtnTxt, sel && styles.optionBtnTxtSel]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {wizardStep === 1 && (
              <>
                <Text style={styles.wizardQuestion}>Jours d'approvisionnement ?</Text>
                <Text style={styles.wizardHint}>Selectionnez un ou plusieurs jours</Text>
                <View style={styles.optionsGrid}>
                  {JOURS_SEMAINE.map(j => {
                    const sel = profil.joursApprovisionnement.includes(j.value);
                    return (
                      <TouchableOpacity
                        key={j.value}
                        style={[styles.optionBtn, sel && styles.optionBtnSel]}
                        onPress={() => toggleJour(j.value)}
                      >
                        <Text style={[styles.optionBtnTxt, sel && styles.optionBtnTxtSel]}>
                          {j.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {wizardStep === 2 && (
              <>
                <Text style={styles.wizardQuestion}>Objectif stock (jours) ?</Text>
                <View style={styles.optionsGrid}>
                  {OBJECTIFS_STOCK.map(v => {
                    const sel = profil.objectifStockJours === v;
                    return (
                      <TouchableOpacity
                        key={v}
                        style={[styles.optionBtn, sel && styles.optionBtnSel]}
                        onPress={() => setProfil(p => ({ ...p, objectifStockJours: v }))}
                      >
                        <Text style={[styles.optionBtnTxt, sel && styles.optionBtnTxtSel]}>
                          {v} j
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {wizardStep === 3 && (
              <>
                <Text style={styles.wizardQuestion}>Marge beneficiaire cible ?</Text>
                <View style={styles.optionsGrid}>
                  {MARGES_OBJECTIF.map(v => {
                    const sel = profil.margeObjectif === v;
                    return (
                      <TouchableOpacity
                        key={v}
                        style={[styles.optionBtn, sel && styles.optionBtnSel]}
                        onPress={() => setProfil(p => ({ ...p, margeObjectif: v }))}
                      >
                        <Text style={[styles.optionBtnTxt, sel && styles.optionBtnTxtSel]}>
                          {v}%
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {wizardStep === 4 && (
              <>
                <Text style={styles.wizardQuestion}>Delai reglement credit (jours) ?</Text>
                <View style={styles.optionsGrid}>
                  {DELAIS_CREDIT.map(v => {
                    const sel = profil.delaiReglementCredit === v;
                    return (
                      <TouchableOpacity
                        key={v}
                        style={[styles.optionBtn, sel && styles.optionBtnSel]}
                        onPress={() => setProfil(p => ({ ...p, delaiReglementCredit: v }))}
                      >
                        <Text style={[styles.optionBtnTxt, sel && styles.optionBtnTxtSel]}>
                          {v} j
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer navigation */}
          <View style={styles.wizardFooter}>
            {wizardStep > 0 && (
              <TouchableOpacity
                style={styles.btnRetour}
                onPress={() => setWizardStep(s => s - 1)}
                disabled={savingProfil}
              >
                <Text style={styles.btnRetourTxt}>Retour</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btnSuivant, savingProfil && styles.btnDisabled]}
              onPress={isLast ? terminerWizard : wizardSuivant}
              disabled={savingProfil}
            >
              {savingProfil
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnSuivantTxt}>{isLast ? 'Terminer' : 'Suivant'}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Rendu : Tab Tableau de bord ───────────────────────────────────────────

  const renderDashboard = () => {
    if (!analyse) {
      return (
        <View style={styles.center}>
          <MaterialCommunityIcons name="chart-timeline-variant" size={48} color="#cbd5e1" />
          <Text style={styles.emptyMsg}>
            {erreur || 'Aucune donnee disponible.\nConfigurez votre profil IA.'}
          </Text>
          <TouchableOpacity
            style={styles.btnReconfig}
            onPress={() => { setWizardStep(0); setShowWizard(true); }}
          >
            <MaterialCommunityIcons name="cog-outline" size={16} color={BLUE} />
            <Text style={styles.btnReconfigTxt}>Configurer le profil IA</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const tend = tendanceInfo(analyse.tendanceCA);
    const sc = scoreColor(analyse.scoreGlobal);
    const detail7 = (analyse.previsionCA30JoursDetail || []).slice(0, 7);
    const maxPrev = Math.max(...detail7.map(d => d.prevision), 1);
    const MAX_BAR_H = 72;
    const croissancePos = (analyse.tauxCroissanceMensuel ?? 0) >= 0;

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.tabContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
            colors={[BLUE]}
          />
        }
      >
        {/* Score global */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Score de sante de la boutique</Text>
          <View style={styles.scoreRow}>
            <View style={[styles.scoreCircle, { backgroundColor: sc }]}>
              <Text style={styles.scoreNum}>{Math.round(analyse.scoreGlobal)}</Text>
              <Text style={styles.scoreSub}>/100</Text>
            </View>
            <View style={styles.scoreInfo}>
              <View style={styles.tendRow}>
                <MaterialCommunityIcons name={tend.icon as any} size={22} color={tend.color} />
                <Text style={[styles.tendTxt, { color: tend.color }]}>{tend.label}</Text>
              </View>
              <Text style={styles.metaLbl}>Croissance mensuelle</Text>
              <Text style={[styles.metaVal, { color: croissancePos ? '#10b981' : '#ef4444' }]}>
                {croissancePos ? '+' : ''}{(analyse.tauxCroissanceMensuel ?? 0).toFixed(1)}%
              </Text>
              <Text style={styles.metaLbl}>Precision du modele</Text>
              <Text style={styles.metaVal}>{(analyse.precisionModele ?? 0).toFixed(0)}%</Text>
            </View>
          </View>
        </View>

        {/* Cartes metriques */}
        <View style={styles.metricsGrid}>
          {([
            { label: 'Prevision CA 7j', val: fmt(analyse.previsionCA7Jours), icon: 'calendar-week', color: '#3b82f6' },
            { label: 'Prevision CA 30j', val: fmt(analyse.previsionCA30Jours), icon: 'calendar-month', color: '#8b5cf6' },
            { label: 'CA hier', val: fmt(analyse.caHier), icon: 'cash-multiple', color: '#10b981' },
            { label: 'CA ce mois', val: fmt(analyse.caCeMois), icon: 'chart-bar', color: '#f59e0b' },
          ] as { label: string; val: string; icon: string; color: string }[]).map(m => (
            <View key={m.label} style={styles.metricCard}>
              <MaterialCommunityIcons name={m.icon as any} size={22} color={m.color} />
              <Text style={styles.metricVal} numberOfLines={1}>{m.val}</Text>
              <Text style={styles.metricLbl}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Graphique barres previsions 7j */}
        {detail7.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Previsions CA — 7 prochains jours</Text>
            <View style={styles.barChart}>
              {detail7.map((d, idx) => {
                const barH = Math.max(4, (d.prevision / maxPrev) * MAX_BAR_H);
                const shortDate = (d.date || '').slice(5); // MM-DD
                const kVal = (d.prevision / 1000).toFixed(0);
                return (
                  <View key={idx} style={styles.barCol}>
                    <Text style={styles.barValTxt} numberOfLines={1}>{kVal}k</Text>
                    <View style={[styles.bar, { height: barH }]} />
                    <Text style={styles.barDateTxt}>{shortDate}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Alertes */}
        {(analyse.alertes?.length ?? 0) > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Alertes</Text>
            {analyse.alertes.map((a, i) => {
              const isCrit = a.severity === 'CRITIQUE';
              return (
                <View key={i} style={[styles.alerteRow, isCrit && styles.alerteRowCrit]}>
                  <MaterialCommunityIcons
                    name={isCrit ? 'alert-circle' : 'information-outline'}
                    size={18}
                    color={isCrit ? '#dc2626' : '#d97706'}
                  />
                  <Text style={[styles.alerteTxt, isCrit && styles.alerteTxtCrit]}>
                    {a.message}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Bouton reconfigurer */}
        <TouchableOpacity
          style={styles.btnReconfig}
          onPress={() => { setWizardStep(0); setShowWizard(true); }}
        >
          <MaterialCommunityIcons name="cog-outline" size={15} color={BLUE} />
          <Text style={styles.btnReconfigTxt}>Reconfigurer mon profil IA</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ── Rendu : Tab Recommandations ───────────────────────────────────────────

  const renderRecommandations = () => {
    const recos = analyse?.recommandations ?? [];

    if (recos.length === 0) {
      return (
        <View style={styles.center}>
          <MaterialCommunityIcons name="check-circle-outline" size={64} color="#10b981" />
          <Text style={styles.emptyMsg}>Boutique en excellente sante !</Text>
          <Text style={styles.emptySubMsg}>Aucune recommandation pour le moment.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={recos}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.tabContent}
        renderItem={({ item: r }) => {
          const done = traitees.has(r.id);
          const ps = prioriteStyle(r.priorite);
          const confColor = r.scoreConfiance > 70
            ? '#10b981'
            : r.scoreConfiance > 40 ? '#f59e0b' : '#ef4444';

          return (
            <View style={[styles.recoCard, done && styles.recoCardDone]}>
              {/* Badge priorite */}
              <View style={[styles.prioriteBadge, { backgroundColor: ps.bg }]}>
                <Text style={[styles.prioriteTxt, { color: ps.text }]}>{r.priorite}</Text>
              </View>

              <Text style={styles.recoTitre}>{r.titre}</Text>
              <Text style={styles.recoDesc}>{r.description}</Text>

              {/* Barre de confiance */}
              <View style={styles.confianceHeader}>
                <Text style={styles.confianceLbl}>Confiance</Text>
                <Text style={[styles.confiancePct, { color: confColor }]}>
                  {r.scoreConfiance}%
                </Text>
              </View>
              <View style={styles.confianceBarBg}>
                <View
                  style={[
                    styles.confianceBarFill,
                    { width: `${r.scoreConfiance}%` as any, backgroundColor: confColor },
                  ]}
                />
              </View>

              {/* Actions */}
              {done ? (
                <Text style={styles.doneTxt}>Traite</Text>
              ) : (
                <View style={styles.recoActionsRow}>
                  <TouchableOpacity
                    style={styles.btnSuivi}
                    onPress={() => feedbackReco(r.id, 'SUIVIE')}
                  >
                    <MaterialCommunityIcons name="check" size={14} color="#fff" />
                    <Text style={styles.btnSuiviTxt}>J'ai suivi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnIgnorer}
                    onPress={() => feedbackReco(r.id, 'IGNOREE')}
                  >
                    <MaterialCommunityIcons name="close" size={14} color="#6b7280" />
                    <Text style={styles.btnIgnorerTxt}>Ignorer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    );
  };

  // ── Rendu : Tab Clients IA ────────────────────────────────────────────────

  const renderClientsIA = () => {
    const segments = analyse?.segmentsClients ?? {};

    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <Text style={styles.sectionTitle}>Segmentation RFM des clients</Text>
        <View style={styles.segmentsGrid}>
          {SEGMENTS_RFM.map(s => (
            <View key={s.key} style={[styles.segCard, { borderLeftColor: s.color }]}>
              <View style={[styles.segIconWrap, { backgroundColor: s.color + '22' }]}>
                <MaterialCommunityIcons name={s.icon as any} size={24} color={s.color} />
              </View>
              <Text style={[styles.segCount, { color: s.color }]}>
                {segments[s.key] ?? 0}
              </Text>
              <Text style={styles.segLabel}>{s.label}</Text>
              <Text style={styles.segDesc}>{s.description}</Text>
            </View>
          ))}
        </View>

        {Object.keys(segments).length === 0 && (
          <View style={styles.center}>
            <MaterialCommunityIcons name="account-group-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyMsg}>Aucune donnee client disponible.</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // ── Rendu principal ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={styles.loadingTxt}>Analyse en cours...</Text>
      </View>
    );
  }

  const TABS = ['Tableau de bord', 'Recommandations', 'Clients IA'];

  return (
    <View style={styles.root}>
      {renderWizard()}

      {/* Barre de tabs manuelle */}
      <View style={styles.tabBar}>
        {TABS.map((label, i) => {
          const active = activeTab === i;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => setActiveTab(i as 0 | 1 | 2)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLbl, active && styles.tabLblActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Contenu par tab */}
      {activeTab === 0 && renderDashboard()}
      {activeTab === 1 && renderRecommandations()}
      {activeTab === 2 && renderClientsIA()}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4f8' },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f0f4f8',
  },
  loadingTxt: { color: '#94a3b8', marginTop: 12, fontSize: 14 },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: BLUE },
  tabLbl: { fontSize: 11, fontWeight: '500', color: '#6b7280' },
  tabLblActive: { color: BLUE, fontWeight: '700' },

  // ── Contenu tab ───────────────────────────────────────────────────────────
  tabContent: { padding: 16, paddingBottom: 36 },

  // ── Card generique ────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    ...CARD_SHADOW,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: DARK, marginBottom: 14 },

  // ── Score ─────────────────────────────────────────────────────────────────
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNum: { color: '#fff', fontSize: 34, fontWeight: '900', lineHeight: 38 },
  scoreSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  scoreInfo: { flex: 1, marginLeft: 18 },
  tendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  tendTxt: { fontSize: 15, fontWeight: '700' },
  metaLbl: { fontSize: 11, color: '#6b7280', marginTop: 6 },
  metaVal: { fontSize: 15, fontWeight: '800', color: DARK },

  // ── Metriques ─────────────────────────────────────────────────────────────
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    width: (SW - 42) / 2,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: DARK,
    marginTop: 6,
    textAlign: 'center',
  },
  metricLbl: { fontSize: 10, color: '#6b7280', marginTop: 3, textAlign: 'center' },

  // ── Graphique barres ──────────────────────────────────────────────────────
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 110,
    gap: 4,
    paddingTop: 8,
  },
  barCol: { flex: 1, alignItems: 'center' },
  bar: {
    backgroundColor: BLUE,
    width: '65%',
    borderRadius: 3,
    minHeight: 4,
  },
  barValTxt: { fontSize: 8, color: '#94a3b8', marginBottom: 3 },
  barDateTxt: { fontSize: 8, color: '#94a3b8', marginTop: 3 },

  // ── Alertes ───────────────────────────────────────────────────────────────
  alerteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    marginTop: 8,
  },
  alerteRowCrit: { backgroundColor: '#fef2f2' },
  alerteTxt: { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 18 },
  alerteTxtCrit: { color: '#991b1b' },

  // ── Bouton reconfig ───────────────────────────────────────────────────────
  btnReconfig: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BLUE,
  },
  btnReconfigTxt: { color: BLUE, fontSize: 13, fontWeight: '600' },

  // ── Recommandations ───────────────────────────────────────────────────────
  recoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...CARD_SHADOW,
  },
  recoCardDone: { opacity: 0.55 },
  prioriteBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 8,
  },
  prioriteTxt: { fontSize: 11, fontWeight: '700' },
  recoTitre: { fontSize: 15, fontWeight: '700', color: DARK, marginBottom: 6 },
  recoDesc: { fontSize: 13, color: '#4b5563', lineHeight: 18, marginBottom: 10 },
  confianceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  confianceLbl: { fontSize: 11, color: '#6b7280' },
  confiancePct: { fontSize: 11, fontWeight: '700' },
  confianceBarBg: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    marginBottom: 12,
  },
  confianceBarFill: { height: 6, borderRadius: 3 },
  recoActionsRow: { flexDirection: 'row', gap: 10 },
  btnSuivi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnSuiviTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  btnIgnorer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnIgnorerTxt: { color: '#6b7280', fontSize: 13 },
  doneTxt: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '700',
    fontStyle: 'italic',
  },

  // ── Vide / erreur ─────────────────────────────────────────────────────────
  emptyMsg: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptySubMsg: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center',
  },

  // ── Segments RFM ──────────────────────────────────────────────────────────
  sectionTitle: { fontSize: 15, fontWeight: '700', color: DARK, marginBottom: 14 },
  segmentsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  segCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    width: (SW - 42) / 2,
    borderLeftWidth: 4,
    ...CARD_SHADOW,
  },
  segIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  segCount: { fontSize: 30, fontWeight: '900' },
  segLabel: { fontSize: 14, fontWeight: '700', color: DARK, marginTop: 2 },
  segDesc: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  // ── Wizard ────────────────────────────────────────────────────────────────
  wizardRoot: { flex: 1, backgroundColor: DARK },
  wizardHeader: {
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  wizardTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
  },
  wizardStepLabel: { color: '#93c5fd', fontSize: 13, marginTop: 4 },
  progressOuter: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 24,
    borderRadius: 3,
  },
  progressInner: { height: 5, backgroundColor: '#60a5fa', borderRadius: 3 },
  wizardContent: { padding: 24, paddingBottom: 16 },
  wizardQuestion: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  wizardHint: { color: '#93c5fd', fontSize: 13, marginBottom: 10 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  optionBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  optionBtnSel: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  optionBtnTxt: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontWeight: '600',
  },
  optionBtnTxtSel: { color: '#fff' },
  wizardFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingBottom: 48,
  },
  btnRetour: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
  },
  btnRetourTxt: { color: '#93c5fd', fontSize: 15, fontWeight: '600' },
  btnSuivant: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSuivantTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.55 },
});
