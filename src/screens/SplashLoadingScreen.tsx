import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function SplashLoadingScreen() {
  // Dots animation — même effet que spl-pulse en CSS
  const dot1 = useRef(new Animated.Value(0.4)).current;
  const dot2 = useRef(new Animated.Value(0.4)).current;
  const dot3 = useRef(new Animated.Value(0.4)).current;

  // Logo ring pulse doux
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo apparaît
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });

    // Dots pulse en boucle — décalés comme CSS animation-delay
    const animDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.4, duration: 560, useNativeDriver: true }),
          Animated.delay(1400 - 280 - 560 - delay),
        ])
      );

    const d1 = animDot(dot1, 0);
    const d2 = animDot(dot2, 200);
    const d3 = animDot(dot3, 400);
    d1.start();
    d2.start();
    d3.start();

    return () => { d1.stop(); d2.stop(); d3.stop(); };
  }, []);

  return (
    <View style={styles.container}>
      {/* Décors lumineux (simule les spl-glow) */}
      <View style={styles.glow1} />
      <View style={styles.glow2} />

      {/* Logo ring */}
      <Animated.View style={[styles.logoRing, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={styles.logoRingInner}>
          <Text style={styles.initials}>GL</Text>
        </View>
      </Animated.View>

      {/* Textes */}
      <Animated.View style={{ alignItems: 'center', opacity: textOpacity }}>
        <Text style={styles.company}>MAIGA CONSULTING</Text>
        <Text style={styles.appname}>Ges Lafia</Text>
        <Text style={styles.tagline}>Gestion de Boutique</Text>
      </Animated.View>

      {/* Dots animés */}
      <View style={styles.dotsRow}>
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
                  outputRange: ['rgba(255,255,255,0.4)', '#1a56db'],
                }),
              },
            ]}
          />
        ))}
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
    position: 'relative',
    overflow: 'hidden',
  },

  // Lueurs décoratives
  glow1: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    top: -80,
    right: -80,
    backgroundColor: 'rgba(26,86,219,0.18)',
  },
  glow2: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    bottom: -60,
    left: -60,
    backgroundColor: 'rgba(26,86,219,0.13)',
  },

  // Logo
  logoRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'transparent',
    padding: 3,
    marginBottom: 28,
    shadowColor: '#1a56db',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  logoRingInner: {
    flex: 1,
    borderRadius: 62,
    backgroundColor: '#1a56db',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  initials: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  // Textes
  company: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  appname: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: 44,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
