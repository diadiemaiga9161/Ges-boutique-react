import React, { useCallback, useRef, useState } from 'react';
import { TextInput, TextInputProps } from 'react-native';

interface Props extends Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> {
  /** Valeur numérique pure (sans points), en FCFA — toujours un entier. */
  value: number;
  /** Appelé avec la valeur numérique pure à chaque saisie (jamais la chaîne formatée). */
  onChangeValue: (valeur: number) => void;
}

/** Retire tout ce qui n'est pas un chiffre (tolère points déjà tapés, espaces, lettres collées…). */
function nettoyerChiffres(texte: string): string {
  return texte.replace(/[^\d]/g, '');
}

/** Formate une chaîne de chiffres avec des points comme séparateurs de milliers : "1000000" → "1.000.000". */
function formaterMilliers(chiffres: string): string {
  if (!chiffres) return '';
  return chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function chiffresVersTexteAffiche(chiffres: string): string {
  return formaterMilliers(chiffres);
}

function valeurVersChiffres(valeur: number): string {
  return Number.isFinite(valeur) && valeur > 0 ? String(Math.round(valeur)) : '';
}

/**
 * Logique de formatage d'un champ de montant FCFA (entier, sans décimales),
 * réutilisable avec N'IMPORTE QUEL composant de saisie (TextInput RN natif,
 * TextInput `react-native-paper` outlined avec label, etc.) — utile pour les
 * écrans dont les champs de montant utilisent déjà le TextInput de Paper
 * (label flottant, mode="outlined"…) et où remplacer tout le composant par
 * un TextInput RN nu changerait visuellement le champ.
 *
 * Renvoie `texte` (chaîne affichée, formatée avec points de milliers) et
 * `onChangeText` (à brancher tel quel sur le TextInput) — le parent, lui,
 * ne voit jamais la chaîne : il reçoit uniquement `onChangeValue(number)`.
 *
 * Corrige le bug historique `parseFloat("1.000.000") === 1`.
 */
export function useMontantInput(value: number, onChangeValue: (valeur: number) => void) {
  const [texte, setTexte] = useState<string>(() => chiffresVersTexteAffiche(valeurVersChiffres(value)));
  // Dernière valeur numérique émise — permet de distinguer un changement
  // venant de la saisie locale (à ignorer) d'un changement externe (reset du
  // formulaire par le parent, valeur préremplie…) qu'il faut resynchroniser.
  const derniereValeurEmise = useRef<number>(value);

  if (value !== derniereValeurEmise.current) {
    derniereValeurEmise.current = value;
    const chiffresExternes = valeurVersChiffres(value);
    const texteAttendu = chiffresVersTexteAffiche(chiffresExternes);
    if (texteAttendu !== texte) setTexte(texteAttendu);
  }

  const onChangeText = useCallback((saisie: string) => {
    const chiffres = nettoyerChiffres(saisie);
    setTexte(chiffresVersTexteAffiche(chiffres));
    const numerique = chiffres ? parseInt(chiffres, 10) : 0;
    derniereValeurEmise.current = numerique;
    onChangeValue(numerique);
  }, [onChangeValue]);

  return { texte, onChangeText };
}

/**
 * Champ de saisie de montant FCFA (entier, sans décimales) — variante prête à
 * l'emploi basée sur le TextInput natif de React Native.
 *
 * Affiche les points comme séparateurs de milliers pendant la saisie ("1.000.000")
 * mais expose au parent, via `onChangeValue`, la valeur NUMÉRIQUE PURE (1000000) —
 * jamais la chaîne formatée.
 *
 * Composant contrôlé : le parent garde un `number` dans son état (ex: `useState(0)`),
 * jamais une chaîne libre.
 *
 * Pour les écrans dont le champ montant utilise le TextInput `react-native-paper`
 * (label, mode="outlined"…), préférer le hook `useMontantInput` ci-dessus.
 */
export function MontantInput({ value, onChangeValue, ...rest }: Props) {
  const { texte, onChangeText } = useMontantInput(value, onChangeValue);

  return (
    <TextInput
      {...rest}
      value={texte}
      onChangeText={onChangeText}
      keyboardType="numeric"
    />
  );
}
