// Bouton réutilisable "Imprimer le reçu" (ticket thermique Bluetooth ESC/POS).
// Gère tout le flux : imprimante mémorisée -> impression directe, sinon
// ouverture du sélecteur d'imprimantes appairées. N'est jamais bloquant pour
// l'écran appelant : toute erreur est affichée via Alert, jamais levée plus
// haut, et l'impression est une action strictement optionnelle/séparée de la
// vente elle-même (voir consigne projet).
import React, { useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, ActivityIndicator as RNActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import SelectionImprimanteModal from './SelectionImprimanteModal';
import {
  TicketVente, ImprimanteBluetooth, ImpressionError,
  imprimerTicket, getImprimanteMemorisee,
} from '../services/thermalPrinter.service';

interface Props {
  // Récupère les données du reçu au moment du clic (peut être asynchrone,
  // ex: charger le détail d'une vente passée). Retourner `null` si les
  // données ne sont pas disponibles (l'appelant a déjà pu afficher son
  // propre message d'erreur dans ce cas).
  getTicket: () => TicketVente | null | Promise<TicketVente | null>;
  // Style compact pour une intégration dans une barre d'actions (carte),
  // sinon rendu en bouton plein largeur.
  compact?: boolean;
  style?: any;
}

export default function ImprimerTicketButton({ getTicket, compact, style }: Props) {
  const { lang } = useLang();
  const [loading, setLoading] = useState(false);
  const [showSelection, setShowSelection] = useState(false);
  const [ticketEnAttente, setTicketEnAttente] = useState<TicketVente | null>(null);

  const messageErreur = (e: ImpressionError): string => {
    switch (e.code) {
      case 'BLUETOOTH_DESACTIVE': return tr('imprimante_bluetooth_desactive', lang);
      case 'BLUETOOTH_INDISPONIBLE': return tr('imprimante_bluetooth_indisponible', lang);
      case 'PERMISSION_REFUSEE': return tr('imprimante_permission_refusee', lang);
      case 'CONNEXION_ECHOUEE': return tr('imprimante_connexion_echouee', lang);
      case 'ECRITURE_ECHOUEE': return tr('imprimante_ecriture_echouee', lang);
      default: return tr('imprimante_module_indisponible', lang);
    }
  };

  const imprimerAvec = async (ticket: TicketVente, imprimante?: ImprimanteBluetooth) => {
    setLoading(true);
    try {
      await imprimerTicket(ticket, imprimante);
      Alert.alert(tr('succes', lang), tr('imprimante_succes', lang));
    } catch (e: any) {
      const err = e instanceof ImpressionError ? e : new ImpressionError('MODULE_INDISPONIBLE', 'Erreur');
      if (err.code === 'AUCUNE_IMPRIMANTE_MEMORISEE' || err.code === 'CONNEXION_ECHOUEE') {
        // Imprimante mémorisée introuvable/injoignable : on laisse
        // l'utilisateur en choisir/reconfirmer une, plutôt que d'abandonner.
        setTicketEnAttente(ticket);
        setShowSelection(true);
      } else {
        Alert.alert(tr('erreur', lang), messageErreur(err));
      }
    }
    setLoading(false);
  };

  const onPress = async () => {
    setLoading(true);
    let ticket: TicketVente | null = null;
    try {
      ticket = await getTicket();
    } catch {
      ticket = null;
    }
    if (!ticket) { setLoading(false); return; }

    const memorisee = await getImprimanteMemorisee();
    if (memorisee) {
      await imprimerAvec(ticket, memorisee);
    } else {
      setLoading(false);
      setTicketEnAttente(ticket);
      setShowSelection(true);
    }
  };

  const onSelectImprimante = (imp: ImprimanteBluetooth) => {
    setShowSelection(false);
    if (ticketEnAttente) imprimerAvec(ticketEnAttente, imp);
  };

  return (
    <>
      {compact ? (
        <TouchableOpacity style={[s.compactBtn, style]} onPress={onPress} disabled={loading}>
          {loading
            ? <RNActivityIndicator size="small" color="#fff" />
            : <MaterialCommunityIcons name="bluetooth-connect" size={15} color="#fff" />}
          <Text style={s.compactBtnText}>{tr('imprimer_ticket', lang)}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[s.fullBtn, style]} onPress={onPress} disabled={loading}>
          {loading
            ? <RNActivityIndicator size="small" color="#fff" />
            : <MaterialCommunityIcons name="bluetooth-connect" size={18} color="#fff" />}
          <Text style={s.fullBtnText}>{tr('imprimer_ticket', lang)}</Text>
        </TouchableOpacity>
      )}

      <SelectionImprimanteModal
        visible={showSelection}
        onClose={() => setShowSelection(false)}
        onSelect={onSelectImprimante}
      />
    </>
  );
}

const s = StyleSheet.create({
  fullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0f766e', borderRadius: 12, paddingVertical: 13,
  },
  fullBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  compactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#0f766e', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
  },
  compactBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
});
