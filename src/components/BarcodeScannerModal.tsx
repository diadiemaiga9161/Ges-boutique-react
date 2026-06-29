import React, { useState, useEffect } from 'react';
import {
  Modal, View, StyleSheet, TouchableOpacity, Alert, TextInput,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface Props {
  visible: boolean;
  onScan: (code: string) => void;
  onClose: () => void;
  title?: string;
}

export default function BarcodeScannerModal({ visible, onScan, onClose, title = 'Scanner un code-barres' }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manuelMode, setManuelMode] = useState(false);
  const [manuelCode, setManuelCode] = useState('');
  const [scanned, setScanned] = useState(false);
  const scanLine = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setManuelMode(false);
      setManuelCode('');
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLine, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(scanLine, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [visible]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScan(data);
    onClose();
  };

  const validerManuel = () => {
    const code = manuelCode.trim();
    if (!code) { Alert.alert('Erreur', 'Veuillez saisir un code'); return; }
    onScan(code);
    onClose();
  };

  const scanLineTranslate = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  const ManuelView = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.manuelBox}>
      <Text style={s.manuelTitle}>Saisie manuelle du code</Text>
      <TextInput
        style={s.manuelInput}
        placeholder="Ex: 3017620422003"
        value={manuelCode}
        onChangeText={setManuelCode}
        keyboardType="default"
        autoFocus
        onSubmitEditing={validerManuel}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button mode="contained" onPress={validerManuel} style={{ flex: 1 }} buttonColor="#1a56db">
          Valider
        </Button>
        <Button mode="outlined" onPress={() => setManuelMode(false)} style={{ flex: 1 }}>
          Retour caméra
        </Button>
      </View>
    </KeyboardAvoidingView>
  );

  if (!visible) return null;

  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={s.center}>
          <Text>Vérification des permissions...</Text>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={s.center}>
          <Text style={s.permTitle}>Accès caméra requis</Text>
          <Text style={s.permSub}>Pour scanner les codes-barres</Text>
          <Button mode="contained" onPress={requestPermission} style={{ marginTop: 16, marginBottom: 12 }} buttonColor="#1a56db">
            Autoriser la caméra
          </Button>
          <Button mode="outlined" onPress={() => setManuelMode(true)}>Saisie manuelle</Button>
          {manuelMode && <ManuelView />}
          <Button mode="text" onPress={onClose} style={{ marginTop: 8 }}>Fermer</Button>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        {!manuelMode && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'qr', 'code128', 'code39', 'upc_a', 'upc_e', 'pdf417'],
            }}
          />
        )}

        {!manuelMode && (
          <View style={s.overlay}>
            <View style={s.header}>
              <Text style={s.headerTitle}>{title}</Text>
            </View>

            <View style={s.frameWrap}>
              <View style={s.frame}>
                <View style={[s.corner, s.tl]} />
                <View style={[s.corner, s.tr]} />
                <View style={[s.corner, s.bl]} />
                <View style={[s.corner, s.br]} />
                <Animated.View style={[s.scanLine, { transform: [{ translateY: scanLineTranslate }] }]} />
              </View>
              <Text style={s.hint}>Cadrez le code-barres dans le rectangle</Text>
            </View>

            <View style={s.footer}>
              <TouchableOpacity style={s.btnManuel} onPress={() => setManuelMode(true)}>
                <Text style={s.btnManuelText}>Saisie manuelle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnCancel} onPress={onClose}>
                <Text style={s.btnCancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {manuelMode && (
          <View style={[s.center, { backgroundColor: '#0f172a' }]}>
            <ManuelView />
            <Button mode="text" textColor="#94a3b8" onPress={onClose} style={{ marginTop: 12 }}>
              Annuler
            </Button>
          </View>
        )}
      </View>
    </Modal>
  );
}

const FRAME = 240;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0f172a' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  header: {
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  frameWrap: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  frame: {
    width: FRAME, height: FRAME,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute', width: 28, height: 28,
    borderColor: '#fff', borderStyle: 'solid',
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  scanLine: {
    position: 'absolute', left: 10, right: 10, height: 2,
    backgroundColor: '#1a56db',
    shadowColor: '#1a56db', shadowOpacity: 0.8, shadowRadius: 6,
  },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 16, textAlign: 'center' },
  footer: {
    backgroundColor: 'rgba(0,0,0,0.7)', paddingBottom: 40, paddingTop: 16,
    alignItems: 'center', gap: 12,
  },
  btnManuel: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1, borderRadius: 50, paddingHorizontal: 36, paddingVertical: 13,
  },
  btnManuelText: { color: '#fff', fontSize: 15 },
  btnCancel: { paddingVertical: 8 },
  btnCancelText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textDecorationLine: 'underline' },
  permTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  permSub: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  manuelBox: { width: '100%', paddingHorizontal: 24, marginTop: 24 },
  manuelTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  manuelInput: {
    backgroundColor: '#1e293b', color: '#fff', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#334155',
  },
});
