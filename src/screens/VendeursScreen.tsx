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
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

// L'entité backend est `Utilisateur` sous /api/utilisateurs (PAS /api/users) —
// un seul champ `nomComplet` (pas nom+prenom séparés), voir user.service.ts
// Ionic. Aucun endpoint de bascule actif/inactif ni de reset mot de passe
// dédié : la désactivation passe par DELETE (soft-delete côté serveur,
// UtilisateurServiceImpl.supprimerUtilisateur met actif=false) et la
// réinitialisation du mot de passe se fait via PUT avec un champ password
// optionnel dans le formulaire de modification — exactement comme
// resources.page.ts (type 'vendeurs') sur Ionic.
interface Vendeur {
  id: number;
  username: string;
  nomComplet: string;
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

function initiales(nomComplet: string): string {
  const parts = (nomComplet || '').trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '') || '?';
}

export default function VendeursScreen() {
  const { lang } = useLang();
  const [vendeurs, setVendeurs] = useState<Vendeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // Modal ajout
  const [showAdd, setShowAdd] = useState(false);
  const [formAdd, setFormAdd] = useState({
    nomComplet: '',
    username: '',
    email: '',
    telephone: '',
    role: 'VENDEUR' as 'ADMIN' | 'VENDEUR',
    motDePasse: '',
  });
  const [savingAdd, setSavingAdd] = useState(false);

  // Modal modification (inclut un champ mot de passe optionnel = reset,
  // comme le formulaire unique de resources.page.ts qui sert aux deux cas)
  const [showEdit, setShowEdit] = useState(false);
  const [selected, setSelected] = useState<Vendeur | null>(null);
  const [formEdit, setFormEdit] = useState({
    nomComplet: '',
    email: '',
    telephone: '',
    role: 'VENDEUR' as 'ADMIN' | 'VENDEUR',
    motDePasse: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const charger = async () => {
    try {
      const res = await api.get('/utilisateurs');
      const liste = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setVendeurs(liste);
      setFromCache(false);
      sauvegarderCache('vendeurs', liste).catch(() => {});
    } catch {
      const cached = await lireCache<Vendeur>('vendeurs');
      if (cached.length > 0) { setVendeurs(cached); setFromCache(true); }
      else setFromCache(false);
    }
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
      nomComplet: v.nomComplet,
      email: v.email,
      telephone: v.telephone || '',
      role: v.role,
      motDePasse: '',
    });
    setShowEdit(true);
  };

  const creerVendeur = async () => {
    if (!formAdd.nomComplet.trim() || !formAdd.username.trim() || !formAdd.motDePasse.trim()) {
      Alert.alert(tr('erreur', lang), tr('remplir_champs', lang));
      return;
    }
    setSavingAdd(true);
    const payloadAdd = {
      username: formAdd.username.trim(),
      password: formAdd.motDePasse,
      nomComplet: formAdd.nomComplet.trim(),
      email: formAdd.email.trim(),
      telephone: formAdd.telephone.trim() || null,
      role: formAdd.role,
    };
    try {
      await executerOuMettreEnFile('vendeur_create', payloadAdd, () => api.post('/utilisateurs', payloadAdd));
      setShowAdd(false);
      setFormAdd({ nomComplet: '', username: '', email: '', telephone: '', role: 'VENDEUR', motDePasse: '' });
      charger();
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible de créer le vendeur');
    }
    setSavingAdd(false);
  };

  const modifierVendeur = async () => {
    if (!selected) return;
    if (!formEdit.nomComplet.trim()) {
      Alert.alert(tr('erreur', lang), tr('remplir_champs', lang));
      return;
    }
    setSavingEdit(true);
    // password: seulement si renseigné (= réinitialisation), comme
    // UserUpdate.password optionnel côté Ionic/backend.
    const payloadEdit: Record<string, any> = {
      nomComplet: formEdit.nomComplet.trim(),
      email: formEdit.email.trim(),
      telephone: formEdit.telephone.trim() || null,
      role: formEdit.role,
    };
    if (formEdit.motDePasse.trim()) payloadEdit.password = formEdit.motDePasse.trim();
    try {
      await executerOuMettreEnFile('vendeur_update', { id: selected.id, data: payloadEdit }, () => api.put(`/utilisateurs/${selected.id}`, payloadEdit));
      setShowEdit(false);
      setSelected(null);
      charger();
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible de modifier');
    }
    setSavingEdit(false);
  };

  const confirmerSupprimer = (v: Vendeur) => {
    Alert.alert(
      'Supprimer cet utilisateur ?',
      `${v.nomComplet} (@${v.username}) sera désactivé.`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: tr('supprimer', lang),
          style: 'destructive',
          onPress: async () => {
            try {
              await executerOuMettreEnFile('vendeur_delete', { id: v.id }, () => api.delete(`/utilisateurs/${v.id}`));
              charger();
            } catch {
              Alert.alert(tr('erreur', lang), 'Impossible de supprimer');
            }
          },
        },
      ],
    );
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
                  <Text style={styles.avatarText}>{initiales(item.nomComplet)}</Text>
                </View>

                <View style={styles.infoCol}>
                  <Text variant="titleMedium" style={styles.nom}>
                    {item.nomComplet}
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
                <TouchableOpacity style={styles.actionBtn} onPress={() => confirmerSupprimer(item)}>
                  <IconButton icon="account-off-outline" size={18} iconColor="#e53935" style={styles.iconBtn} />
                  <Text style={[styles.actionLabel, { color: '#e53935' }]}>{tr('supprimer', lang)}</Text>
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
          <TextInput label="Nom complet *" value={formAdd.nomComplet} onChangeText={t => setFormAdd({ ...formAdd, nomComplet: t })} mode="outlined" style={styles.input} />
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

        {/* Modal modification (mot de passe optionnel = réinitialisation) */}
        <Modal
          visible={showEdit}
          onDismiss={() => { setShowEdit(false); setSelected(null); }}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>Modifier l'utilisateur</Text>
          {selected && (
            <Text style={styles.sub}>@{selected.username}</Text>
          )}
          <TextInput label="Nom complet *" value={formEdit.nomComplet} onChangeText={t => setFormEdit({ ...formEdit, nomComplet: t })} mode="outlined" style={[styles.input, { marginTop: 10 }]} />
          <TextInput label={tr('email', lang)} value={formEdit.email} onChangeText={t => setFormEdit({ ...formEdit, email: t })} mode="outlined" style={styles.input} keyboardType="email-address" autoCapitalize="none" />
          <TextInput label={tr('telephone', lang)} value={formEdit.telephone} onChangeText={t => setFormEdit({ ...formEdit, telephone: t })} mode="outlined" style={styles.input} keyboardType="phone-pad" />
          <TextInput label="Nouveau mot de passe (optionnel)" value={formEdit.motDePasse} onChangeText={t => setFormEdit({ ...formEdit, motDePasse: t })} mode="outlined" style={styles.input} secureTextEntry />

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
  card: { marginBottom: 10, borderRadius: 16 },
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
    borderRadius: 20,
    padding: 20,
    maxHeight: '92%',
  },
  modalTitle: { fontWeight: 'bold', marginBottom: 14, color: '#1a56db' },
  modalBtns: { flexDirection: 'row', marginTop: 8 },
  input: { marginBottom: 10 },
  roleLabel: { fontSize: 13, color: '#666', marginBottom: 4, marginTop: 4 },
});
