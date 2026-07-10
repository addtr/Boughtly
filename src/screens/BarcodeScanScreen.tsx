import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { lookupBarcode, setPendingBarcodeItemName } from '../services/barcode';
import { Palette, fonts, radii, spacing } from '../theme/theme';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { successFeedback } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'BarcodeScan'>;

export function BarcodeScanScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [permission, requestPermission] = useCameraPermissions();
  const [looking, setLooking] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);
  const handledRef = useRef(false);

  async function onScanned(data: string) {
    if (handledRef.current) return;
    handledRef.current = true;
    setLooking(true);
    const name = await lookupBarcode(data);
    if (name) {
      successFeedback();
      setPendingBarcodeItemName(name);
      navigation.goBack();
    } else {
      setLooking(false);
      setNotFound(data);
      // Let them try another angle / a different code
      setTimeout(() => {
        handledRef.current = false;
      }, 1500);
    }
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>
          Barcode scanning works on your phone — open Boughtly there to try it.
        </Text>
        <Button title="Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="barcode-outline" size={56} color={colors.primary} />
        <Text style={styles.centerTitle}>Point at the barcode</Text>
        <Text style={styles.centerText}>
          Boughtly uses the camera to read a product’s barcode and fill in its name
          for you.
        </Text>
        <Button title="Allow camera" onPress={() => void requestPermission()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
        }}
        onBarcodeScanned={({ data }) => void onScanned(data)}
      />
      {/* Framing guide */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <Text style={styles.hint}>
          {looking
            ? 'Looking that up…'
            : notFound
            ? `Couldn’t find ${notFound} — try again or type the name.`
            : 'Line the barcode up inside the box'}
        </Text>
        {looking && <ActivityIndicator color="#FFFFFF" style={{ marginTop: spacing.sm }} />}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 260,
    height: 150,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: radii.lg,
    backgroundColor: 'transparent',
  },
  hint: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    marginTop: spacing.lg,
    textAlign: 'center',
    maxWidth: 320,
    overflow: 'hidden',
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  centerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    color: colors.deepBlue,
  },
  centerText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
