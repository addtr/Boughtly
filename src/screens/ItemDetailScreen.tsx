import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CountdownRing } from '../components/CountdownRing';
import { Button, Card } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../store/AppStateContext';
import { colors, fonts, radii, spacing } from '../theme/theme';
import { daysUntil, formatDate, formatPrice, nearestDeadline } from '../utils/dates';
import { warningFeedback } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

export function ItemDetailScreen({ navigation, route }: Props) {
  const { items, deleteItem } = useAppState();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const item = useMemo(
    () => items.find((i) => i.id === route.params.itemId),
    [items, route.params.itemId]
  );

  if (!item) {
    // Item was deleted while this screen was open
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>This item is no longer tracked.</Text>
        <Button title="Back to dashboard" onPress={() => navigation.popToTop()} />
      </View>
    );
  }

  const returnDaysLeft = daysUntil(item.returnDeadlineDate);
  const warrantyDaysLeft = daysUntil(item.warrantyExpirationDate);
  const deadline = nearestDeadline(item);
  const statusExpired = deadline.daysLeft < 0;
  const statusUrgent = !statusExpired && deadline.daysLeft <= 3;
  const statusText = statusExpired
    ? 'Protection ended'
    : deadline.kind === 'return'
    ? `Returnable — ${deadline.daysLeft === 0 ? 'last day' : `${deadline.daysLeft} days left`}`
    : `Under warranty — ${deadline.daysLeft} days left`;

  function confirmDelete() {
    warningFeedback();
    Alert.alert(
      'Stop tracking this item?',
      'Its reminders will be cancelled too. This can’t be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteItem(item!.id);
            navigation.popToTop();
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{item.itemName}</Text>
      <Text style={styles.subtitle}>
        {item.storeName} · {formatPrice(item.price)} · bought {formatDate(item.purchaseDate)}
      </Text>
      <View
        style={[
          styles.statusPill,
          {
            backgroundColor: statusExpired
              ? colors.divider
              : statusUrgent
              ? colors.coralSoft
              : colors.primarySoft,
          },
        ]}
      >
        <Text
          style={[
            styles.statusPillText,
            {
              color: statusExpired
                ? colors.muted
                : statusUrgent
                ? colors.coral
                : colors.primary,
            },
          ]}
        >
          {statusText}
        </Text>
      </View>

      {/* Deadlines */}
      <View style={styles.ringsRow}>
        <Card style={styles.ringCard}>
          <CountdownRing
            daysLeft={returnDaysLeft}
            totalDays={item.returnWindowDays}
            size={96}
            label="days"
          />
          <Text style={styles.ringTitle}>Return window</Text>
          <Text style={styles.ringDate}>
            {returnDaysLeft < 0 ? 'Closed ' : 'Closes '}
            {formatDate(item.returnDeadlineDate)}
          </Text>
        </Card>
        <Card style={styles.ringCard}>
          <CountdownRing
            daysLeft={warrantyDaysLeft}
            totalDays={item.warrantyLengthDays}
            size={96}
            label="days"
          />
          <Text style={styles.ringTitle}>Warranty</Text>
          <Text style={styles.ringDate}>
            {warrantyDaysLeft < 0 ? 'Ended ' : 'Ends '}
            {formatDate(item.warrantyExpirationDate)}
          </Text>
        </Card>
      </View>

      {/* Receipt */}
      <Text style={styles.sectionTitle}>Receipt</Text>
      {item.receiptImageUri ? (
        <Card style={styles.receiptCard}>
          <Pressable onPress={() => setReceiptOpen(true)}>
            <Image source={{ uri: item.receiptImageUri }} style={styles.receiptImage} />
            <Text style={styles.receiptHint}>Tap to view full screen</Text>
          </Pressable>
        </Card>
      ) : (
        <Card style={styles.receiptCard}>
          <Text style={styles.noReceipt}>
            No receipt photo yet. Add one from Edit so it’s there when you need it.
          </Text>
        </Card>
      )}

      {item.notes ? (
        <>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Card>
            <Text style={styles.notes}>{item.notes}</Text>
          </Card>
        </>
      ) : null}

      <View style={styles.actions}>
        <Button
          title="Edit details"
          onPress={() => navigation.navigate('AddItem', { itemId: item.id })}
        />
        <Button title="Stop tracking" variant="danger" onPress={confirmDelete} />
      </View>

      {/* Full-screen zoomable receipt */}
      <Modal
        visible={receiptOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setReceiptOpen(false)}
      >
        <View style={styles.viewerBackdrop}>
          <ScrollView
            style={styles.viewerScroll}
            contentContainerStyle={styles.viewerContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            bouncesZoom
          >
            {item.receiptImageUri && (
              <Image
                source={{ uri: item.receiptImageUri }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            )}
          </ScrollView>
          <Pressable
            style={styles.viewerClose}
            onPress={() => setReceiptOpen(false)}
            hitSlop={12}
            accessibilityLabel="Close receipt"
          >
            <Text style={styles.viewerCloseText}>✕</Text>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    color: colors.deepBlue,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 100,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  statusPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  ringsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  ringCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  ringTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepBlue,
    marginTop: spacing.md,
  },
  ringDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.deepBlue,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  receiptCard: {
    padding: spacing.sm,
  },
  receiptImage: {
    width: '100%',
    height: 320,
    borderRadius: radii.md,
    resizeMode: 'contain',
    backgroundColor: colors.divider,
  },
  receiptHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 18, 28, 0.96)',
  },
  viewerScroll: {
    flex: 1,
  },
  viewerContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
    minHeight: 400,
  },
  viewerClose: {
    position: 'absolute',
    top: 56,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCloseText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: fonts.bodySemiBold,
  },
  noReceipt: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    padding: spacing.sm,
  },
  notes: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  missing: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  missingText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.muted,
  },
});
