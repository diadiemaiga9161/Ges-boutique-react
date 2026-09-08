// Sélecteur d'imprimante Bluetooth déjà appairée (ne gère pas l'appairage
// initial, voir thermalPrinter.service.ts). Utilisé par ImprimerTicketButton.
import React, { useEffect, useState } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import {
  ImprimanteBluetooth, LargeurPapier, ImpressionError,
  listerImprimantesAppairees, ouvrirReglagesBluetooth,
  getLargeurPapier, setLargeurPapier,
} from '../services/thermalPrinter.service';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (imp: ImprimanteBluetooth) => void;
}

export default function SelectionImprimanteModal({ visible, onClose, onSelect }: Props) {
  const { lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [appareils, setAppareils] = useState<ImprimanteBluetooth[]>([]);
  const [erreur, setErreur] = useState<ImpressionError | null>(null);
  const [largeur, setLargeur] = useState<LargeurPapier>(32);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setErreur(null);
    getLargeurPapier().then(setLargeur);
    listerImprimantesAppairees()
      .then(liste => setAppareils(liste))
      .catch(e => setErreur(e instanceof ImpressionError ? e : new ImpressionError('MODULE_INDISPONIBLE', tr('imprimante_module_indisponible', lang))))
      .finally(() => setLoading(false));
  }, [visible]);

  const changerLargeur = async (l: LargeurPapier) => {
    setLargeur(l);
    await setLargeurPapier(l);
  };

  const messageErreur = (e: ImpressionError | null): string => {
    if (!e) return '';
    switch (e.code) {
      case 'BLUETOOTH_DESACTIVE': return tr('imprimante_bluetooth_desactive', lang);
      case 'BLUETOOTH_INDISPONIBLE': return tr('imprimante_bluetooth_indisponible', lang);
      case 'AUCUNE_IMPRIMANTE_APPAIREE': return tr('imprimante_aucune_appairee', lang);
      case 'PERMISSION_REFUSEE': return tr('imprimante_permission_refusee', lang);
      default: return tr('imprimante_module_indisponible', lang);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.head}>
            <Text style={s.title}>{tr('imprimante_choisir_titre', lang)}</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={s.tailleRow}>
            <Text style={s.tailleLabel}>{tr('imprimante_taille_papier', lang)}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[32, 48].map(l => (
                <TouchableOpacity
                  key={l}
                  style={[s.chip, largeur === l && s.chipActive]}
                  onPress={() => changerLargeur(l as LargeurPapier)}
                >
                  <Text style={[s.chipText, largeur === l && s.chipTextActive]}>{l === 32 ? '58mm' : '80mm'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 30 }} size="large" color="#1a56db" />
          ) : erreur ? (
            <View style={s.erreurBox}>
              <MaterialCommunityIcons name="bluetooth-off" size={40} color="#94a3b8" />
              <Text style={s.erreurText}>{messageErreur(erreur)}</Text>
              {erreur.code === 'BLUETOOTH_DESACTIVE' || erreur.code === 'AUCUNE_IMPRIMANTE_APPAIREE' ? (
                <Button mode="outlined" onPress={ouvrirReglagesBluetooth} style={{ marginTop: 12 }}>
                  {tr('imprimante_ouvrir_reglages', lang)}
                </Button>
              ) : null}
            </View>
          ) : (
            <FlatList
              data={appareils}
              keyExtractor={item => item.address}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.appareilRow} onPress={() => onSelect(item)}>
                  <MaterialCommunityIcons name="printer-outline" size={22} color="#1a56db" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.appareilNom}>{item.name}</Text>
                    <Text style={s.appareilAdresse}>{item.address}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
            />
          )}

          <Button mode="text" onPress={onClose} style={{ marginTop: 8 }}>
            {tr('annuler', lang)}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#64748b' },
  tailleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  tailleLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  chipActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#fff' },
  erreurBox: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 12 },
  erreurText: { textAlign: 'center', color: '#64748b', marginTop: 10, fontSize: 13 },
  appareilRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  appareilNom: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  appareilAdresse: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
});
