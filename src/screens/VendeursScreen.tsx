import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  FAB,
  ActivityIndicator,
  Modal,
  Portal,
  TextInput,
  Button,
  Divider,
  IconButton,
  RadioButton,
} from 'react-native-paper';
import api from '../services/api.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

interface Vendeur {
  id: number;
  nom: string;
  prenom: string;
  username: string;
  email: string;
  telephone?: string;
  role: 'ADMIN' | 'VENDEUR';
  actif: boolean;
}

const ROLES: Array<'ADMIN' | 'VENDEUR'> = ['ADMIN', 'VENDEUR'];

const ROLE_COLOR: Record<string, string> = {
  ADMIN: '#1a56db',
  VENDEUR: '#4caf50',
};

function initiales(nom: string, prenom: string): string {
  return ((prenom?.[0] || '') + (nom?.[0] || '')).toUpperCase() || '?';
}

export default function VendeursScreen() {
  const { lang } = useLang();
  const [vendeurs, setVendeurs] = useState<Vendeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal ajout
  const [showAdd, setShowAdd] = useState(false);
  const [formAdd, setFormAdd] = useState({
    nom: '',
    prenom: '',
    username: '',
    email: '',
    telephone: '',
    role: 'VENDEUR' as 'ADMIN' | 'VENDEUR',
    motDePasse: '',
  });
  const [savingAdd, setSavingAdd] = useState(false);

  // Modal modification
  const [showEdit, setShowEdit] = useState(false);
  const [selected, setSelected] = useState<Vendeur | null>(null);
  const [formEdit, setFormEdit] = useState({
    nom: '',
    prenom: '',
    username: '',
    email: '',
    telephone: '',
    role: 'VENDEUR' as 'ADMIN' | 'VENDEUR',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal reset MDP
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [savingReset, setSavingReset] = useState(false);

  const charger = async () => {
    try {
      const res = await api.get('/users');
      setVendeurs(res.data?.data || res.data || []);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const totalUtilisateurs = vendeurs.length;
  const nbAdmins = vendeurs.filter(v => v.role === 'ADMIN').length;
  const nbVendeursActifs = vendeurs.filter(v => v.role === 'VENDEUR' && v.actif).length;

  const ouvrirModif = (v: Vendeur) => {
    setSelected(v);
    setFormEdit({
      nom: v.nom,
      prenom: v.prenom,
      username: v.username,
      email: v.email,
      telephone: v.telephone || '',
      role: v.role,
    });
    setShowEdit(true);
  };

  const ouvrirReset = (v: Vendeur) => {
    setSelected(v);
    setNewPassword('');
    setShowReset(true);
  };

  const toggleStatut = (v: Vendeur) => {
    Alert.alert(
      v.actif ? 'Désactiver' : 'Activer',
      `${v.actif ? 'Désactiver' : 'Activer'} ${v.prenom} ${v.nom} ?`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: tr('confirmer', lang),
          onPress: async () => {
            try {
              await api.patch(`/users/${v.id}/statut`, { actif: !v.actif });
              charger();
            } catch {
              Alert.alert(tr('erreur', lang), 'Impossible de modifier le statut');
            }
          },
        },
      ],
    );
  };

  const creerVendeur = async () => {
    if (!formAdd.nom.trim() || !formAdd.username.trim() || !formAdd.motDePasse.trim()) {
      Alert.alert(tr('erreur', lang), tr('remplir_champs', lang));
      return;
    }
    setSavingAdd(true);
    try {
      await api.post('/users', {
        nom: formAdd.nom.trim(),
        prenom: formAdd.prenom.trim(),
        username: formAdd.username.trim(),
        email: formAdd.email.trim(),
        telephone: formAdd.telephone.trim() || null,
        role: formAdd.role,
        motDePasse: formAdd.motDePasse,
      });
      setShowAdd(false);
      setFormAdd({ nom: '', prenom: '', username: '', email: '', telephone: '', role: 'VENDEUR', motDePasse: '' });
      charger();
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible de créer le vendeur');
    }
    setSavingAdd(false);
  };

  const modifierVendeur = async () => {
    if (!selected) return;
    if (!formEdit.nom.trim() || !formEdit.username.trim()) {
      Alert.alert(tr('erreur', lang), tr('remplir_champs', lang));
      return;
    }
    setSavingEdit(true);
    try {
      await api.put(`/users/${selected.id}`, {
        nom: formEdit.nom.trim(),
        prenom: formEdit.prenom.trim(),
        username: formEdit.username.trim(),
        email: formEdit.email.trim(),
        telephone: formEdit.telephone.trim() || null,
        role: formEdit.role,
      });
      setShowEdit(false);
      setSelected(null);
      charger();
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible de modifier');
    }
    setSavingEdit(false);
  };

  const resetPassword = async () => {
    if (!selected) return;
    if (!newPassword.trim() || newPassword.trim().length < 4) {
      Alert.alert(tr('erreur', lang), 'Le mot de passe doit faire au moins 4 caractères');
      return;
    }
    setSavingReset(true);
    try {
      await api.post(`/users/${selected.id}/reset-password`, { newPassword: newPassword.trim() });
      Alert.alert('Succès', 'Mot de passe réinitialisé');
      setShowReset(false);
      setSelected(null);
      setNewPassword('');
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible de réinitialiser le mot de passe');
    }
    setSavingReset(false);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      {/* Bannière stats */}
      <View style={styles.banner}>
        <View style={styles.bannerItem}>
          <Text style={styles.bannerVal}>{totalUtilisateurs}</Text>
          <Text style={styles.bannerLabel}>Utilisateurs</Text>
        </View>
        <View style={styles.bannerSep} />
        <View style={styles.bannerItem}>
          <Text style={styles.bannerVal}>{nbAdmins}</Text>
          <Text style={styles.bannerLabel}>Admins</Text>
        </View>
        <View style={styles.bannerSep} />
        <View style={styles.bannerItem}>
          <Text style={styles.bannerVal}>{nbVendeursActifs}</Text>
          <Text style={styles.bannerLabel}>Vendeurs actifs</Text>
        </View>
      </View>

      <FlatList
        data={vendeurs}
        keyExtractor={v => String(v.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun utilisateur trouvé</Text>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                {/* Avatar initiales */}
                <View style={[styles.avatar, { backgroundColor: ROLE_COLOR[item.role] }]}>
                  <Text style={styles.avatarText}>{initiales(item.nom, item.prenom)}</Text>
                </View>

                <View style={styles.infoCol}>
                  <Text variant="titleMedium" style={styles.nom}>
                    {item.prenom} {item.nom}
                  </Text>
                  <Text style={styles.username}>@{item.username}</Text>
                  {item.email ? <Text style={styles.sub}>{item.email}</Text> : null}
                  {item.telephone ? <Text style={styles.sub}>{item.telephone}</Text> : null}
                </View>

                <View style={styles.badgeCol}>
                  <View style={[styles.badge, { backgroundColor: ROLE_COLOR[item.role] + '22' }]}>
                    <Text style={[styles.badgeText, { color: ROLE_COLOR[item.role] }]}>
                      {item.role}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: item.actif ? '#4caf5022' : '#9e9e9e22', marginTop: 4 }]}>
                    <Text style={[styles.badgeText, { color: item.actif ? '#4caf50' : '#9e9e9e' }]}>
                      {item.actif ? 'Actif' : 'Inactif'}
                    </Text>
                  </View>
                </View>
              </View>

              <Divider style={{ marginVertical: 8 }} />

              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => ouvrirModif(item)}>
                  <IconButton icon="pencil-outline" size={18} iconColor="#1a56db" style={styles.iconBtn} />
                  <Text style={styles.actionLabel}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleStatut(item)}>
                  <IconButton
                    icon={item.actif ? 'account-off-outline' : 'account-check-outline'}
                    size={18}
                    iconColor={item.actif ? '#e53935' : '#4caf50'}
                    style={styles.iconBtn}
                  />
                  <Text style={[styles.actionLabel, { color: item.actif ? '#e53935' : '#4caf50' }]}>
                    {item.actif ? 'Désactiver' : 'Activer'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => ouvrirReset(item)}>
                  <IconButton icon="lock-reset" size={18} iconColor="#ff9800" style={styles.iconBtn} />
                  <Text style={[styles.actionLabel, { color: '#ff9800' }]}>Réinitialiser MDP</Text>
                </TouchableOpacity>
              </View>
            </Card.Content>
          </Card>
        )}
      />

      <FAB icon="plus" style={styles.fab} onPress={() => setShowAdd(true)} />

      <Portal>
        {/* Modal nouveau vendeur */}
        <Modal
          visible={showAdd}
          onDismiss={() => setShowAdd(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>Nouveau vendeur</Text>
          <TextInput label="Nom *" value={formAdd.nom} onChangeText={t => setFormAdd({ ...formAdd, nom: t })} mode="outlined" style={styles.input} />
          <TextInput label="Prénom" value={formAdd.prenom} onChangeText={t => setFormAdd({ ...formAdd, prenom: t })} mode="outlined" style={styles.input} />
          <TextInput label="Username *" value={formAdd.username} onChangeText={t => setFormAdd({ ...formAdd, username: t })} mode="outlined" style={styles.input} autoCapitalize="none" />
          <TextInput label={tr('email', lang)} value={formAdd.email} onChangeText={t => setFormAdd({ ...formAdd, email: t })} mode="outlined" style={styles.input} keyboardType="email-address" autoCapitalize="none" />
          <TextInput label={tr('telephone', lang)} value={formAdd.telephone} onChangeText={t => setFormAdd({ ...formAdd, telephone: t })} mode="outlined" style={styles.input} keyboardType="phone-pad" />
          <TextInput label="Mot de passe initial *" value={formAdd.motDePasse} onChangeText={t => setFormAdd({ ...formAdd, motDePasse: t })} mode="outlined" style={styles.input} secureTextEntry />

          <Text style={styles.roleLabel}>Rôle</Text>
          <RadioButton.Group onValueChange={v => setFormAdd({ ...formAdd, role: v as any })} value={formAdd.role}>
            {ROLES.map(r => (
              <RadioButton.Item key={r} label={r} value={r} />
            ))}
          </RadioButton.Group>

          <View style={styles.modalBtns}>
            <Button mode="outlined" onPress={() => setShowAdd(false)} style={{ flex: 1, marginRight: 8 }}>
              {tr('annuler', lang)}
            </Button>
            <Button mode="contained" onPress={creerVendeur} loading={savingAdd} disabled={savingAdd} style={{ flex: 1 }}>
              {tr('enregistrer', lang)}
            </Button>
          </View>
        </Modal>

        {/* Modal modification */}
        <Modal
          visible={showEdit}
          onDismiss={() => { setShowEdit(false); setSelected(null); }}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>Modifier l'utilisateur</Text>
          <TextInput label="Nom *" value={formEdit.nom} onChangeText={t => setFormEdit({ ...formEdit, nom: t })} mode="outlined" style={styles.input} />
          <TextInput label="Prénom" value={formEdit.prenom} onChangeText={t => setFormEdit({ ...formEdit, prenom: t })} mode="outlined" style={styles.input} />
          <TextInput label="Username *" value={formEdit.username} onChangeText={t => setFormEdit({ ...formEdit, username: t })} mode="outlined" style={styles.input} autoCapitalize="none" />
          <TextInput label={tr('email', lang)} value={formEdit.email} onChangeText={t => setFormEdit({ ...formEdit, email: t })} mode="outlined" style={styles.input} keyboardType="email-address" autoCapitalize="none" />
          <TextInput label={tr('telephone', lang)} value={formEdit.telephone} onChangeText={t => setFormEdit({ ...formEdit, telephone: t })} mode="outlined" style={styles.input} keyboardType="phone-pad" />

          <Text style={styles.roleLabel}>Rôle</Text>
          <RadioButton.Group onValueChange={v => setFormEdit({ ...formEdit, role: v as any })} value={formEdit.role}>
            {ROLES.map(r => (
              <RadioButton.Item key={r} label={r} value={r} />
            ))}
          </RadioButton.Group>

          <View style={styles.modalBtns}>
            <Button mode="outlined" onPress={() => { setShowEdit(false); setSelected(null); }} style={{ flex: 1, marginRight: 8 }}>
              {tr('annuler', lang)}
            </Button>
            <Button mode="contained" onPress={modifierVendeur} loading={savingEdit} disabled={savingEdit} style={{ flex: 1 }}>
              {tr('enregistrer', lang)}
            </Button>
          </View>
        </Modal>

        {/* Modal réinitialiser MDP */}
        <Modal
          visible={showReset}
          onDismiss={() => { setShowReset(false); setSelected(null); setNewPassword(''); }}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>Réinitialiser MDP</Text>
          {selected && (
            <Text style={styles.sub}>
              {selected.prenom} {selected.nom} (@{selected.username})
            </Text>
          )}
          <TextInput
            label="Nouveau mot de passe *"
            value={newPassword}
            onChangeText={setNewPassword}
            mode="outlined"
            style={[styles.input, { marginTop: 14 }]}
            secureTextEntry
          />
          <View style={styles.modalBtns}>
            <Button mode="outlined" onPress={() => { setShowReset(false); setSelected(null); setNewPassword(''); }} style={{ flex: 1, marginRight: 8 }}>
              {tr('annuler', lang)}
            </Button>
            <Button mode="contained" onPress={resetPassword} loading={savingReset} disabled={savingReset} style={{ flex: 1, backgroundColor: '#ff9800' }}>
              Réinitialiser
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Bannière
  banner: {
    flexDirection: 'row',
    backgroundColor: '#1a56db',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  bannerItem: { alignItems: 'center', flex: 1 },
  bannerVal: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  bannerLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, textAlign: 'center' },
  bannerSep: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.3)' },

  // Card
  card: { marginBottom: 10, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },

  // Avatar
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Info
  infoCol: { flex: 1 },
  nom: { fontWeight: 'bold' },
  username: { color: '#666', fontSize: 12 },
  sub: { color: '#888', fontSize: 12, marginTop: 1 },

  // Badges
  badgeCol: { alignItems: 'flex-end', marginLeft: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },

  // Actions
  actions: { flexDirection: 'row', justifyContent: 'space-around' },
  actionBtn: { alignItems: 'center' },
  iconBtn: { margin: 0 },
  actionLabel: { fontSize: 10, color: '#555', marginTop: -4 },

  // Divers
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  fab: { position: 'absolute', bottom: 20, right: 20 },

  // Modals
  modal: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '92%',
  },
  modalTitle: { fontWeight: 'bold', marginBottom: 14, color: '#1a56db' },
  modalBtns: { flexDirection: 'row', marginTop: 8 },
  input: { marginBottom: 10 },
  roleLabel: { fontSize: 13, color: '#666', marginBottom: 4, marginTop: 4 },
});
