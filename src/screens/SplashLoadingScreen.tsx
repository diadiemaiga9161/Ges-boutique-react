import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Image, StyleSheet } from 'react-native';
import { useColors } from '../theme/colors';

interface Props {
  ready?: boolean;
  onComplete?: () => void;
}

export default function SplashLoadingScreen({ ready = false, onComplete }: Props) {
  const colors = useColors();
  const dot1 = useRef(new Animated.Value(0.4)).current;
  const dot2 = useRef(new Animated.Value(0.4)).current;
  const dot3 = useRef(new Animated.Value(0.4)).current;

  const logoScale   = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;

  const checkScale   = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  const [animDone, setAnimDone] = useState(false);
  const completeCalled = useRef(false);

  // Animation d'entrée
  useEffect(() => {
    const dotLoops = [dot1, dot2, dot3].map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dot, { toValue: 1, duration: 280, useNativeDriver: false }),
          Animated.timing(dot, { toValue: 0.4, duration: 560, useNativeDriver: false }),
          Animated.delay(1400 - 280 - 560 - i * 200),
        ])
      )
    );

    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start(() => {
        Animated.timing(dotsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => {
          setAnimDone(true);
        });
      });
    });

    dotLoops.forEach(l => l.start());
    return () => dotLoops.forEach(l => l.stop());
  }, []);

  // Quand tout est prêt → coche ✓
  useEffect(() => {
    if (!animDone || !ready || completeCalled.current) return;

    // Faire disparaître les dots
    Animated.timing(dotsOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      // Faire apparaître la coche
      Animated.parallel([
        Animated.spring(checkScale, { toValue: 1, tension: 100, friction: 6, useNativeDriver: true }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        // Après 600ms afficher l'écran suivant
        setTimeout(() => {
          if (!completeCalled.current) {
            completeCalled.current = true;
            onComplete?.();
          }
        }, 600);
      });
    });
  }, [animDone, ready]);

  return (
    <View style={[styles.container, { backgroundColor: colors.hero }]}>
      {/* Décors lumineux */}
      <View style={styles.glow1} />
      <View style={styles.glow2} />

      {/* Logo */}
      <Animated.View style={[styles.logoRing, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={styles.logoRingInner}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImg} />
        </View>
      </Animated.View>

      {/* Textes */}
      <Animated.View style={{ alignItems: 'center', opacity: textOpacity }}>
        <Text style={styles.company}>MAIGA CONSULTING</Text>
        <Text style={styles.appname}>Ges Lafia</Text>
        <Text style={styles.tagline}>Gestion de Boutique</Text>
      </Animated.View>

      {/* Zone indicateur : dots ou coche */}
      <View style={styles.indicatorZone}>
        {/* Dots */}
        <Animated.View style={[styles.dotsRow, { opacity: dotsOpacity }]}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: dot,
                  transform: [{ scale: dot.interpolate({ inputRange: [0.4, 1], outputRange: [0.6, 1.1] }) }],
                  backgroundColor: dot.interpolate({
                    inputRange: [0.4, 1],
                    outputRange: ['rgba(255,255,255,0.4)', colors.primary],
                  }),
                },
              ]}
            />
          ))}
        </Animated.View>

        {/* Coche ✓ */}
        <Animated.View
          style={[
            styles.checkCircle,
            { opacity: checkOpacity, transform: [{ scale: checkScale }] },
          ]}
        >
          <Text style={styles.checkText}>✓</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#081648',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  glow1: {
    position: 'absolute',
    width: 340, height: 340, borderRadius: 170,
    top: -80, right: -80,
    backgroundColor: 'rgba(26,86,219,0.18)',
  },
  glow2: {
    position: 'absolute',
    width: 260, height: 260, borderRadius: 130,
    bottom: -60, left: -60,
    backgroundColor: 'rgba(26,86,219,0.13)',
  },

  logoRing: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'transparent',
    padding: 4,
    marginBottom: 28,
    shadowColor: '#1a56db',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  logoRingInner: {
    flex: 1,
    borderRadius: 61,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: 110,
    height: 110,
    borderRadius: 57,
  },

  company: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11, fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  appname: {
    color: '#ffffff',
    fontSize: 32, fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13, letterSpacing: 0.5,
    marginBottom: 32,
  },

  indicatorZone: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
  },

  checkCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  checkText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
});
