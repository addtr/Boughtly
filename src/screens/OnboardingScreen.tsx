import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CountdownRing } from '../components/CountdownRing';
import { Button } from '../components/ui';
import { RootStackParamList } from '../navigation/types';
import { ensureNotificationSetup } from '../notifications/notifications';
import { useAppState } from '../store/AppStateContext';
import { colors, fonts, spacing } from '../theme/theme';
import { successFeedback } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const { width } = Dimensions.get('window');

const styles_art = StyleSheet.create({
  bell: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

interface Slide {
  key: string;
  title: string;
  body: string;
  art: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    key: 'protect',
    title: 'Protect everything you buy',
    body: 'Snap a receipt and Boughtly keeps the proof, the deadlines, and the coverage in one place.',
    art: (
      <Image
        source={require('../../assets/splash-icon.png')}
        style={{ width: 190, height: 190 }}
        resizeMode="contain"
      />
    ),
  },
  {
    key: 'ring',
    title: 'Never miss a return window',
    body: 'Countdown rings show exactly how long you have to change your mind — blue when there’s time, coral when it’s urgent.',
    art: <CountdownRing daysLeft={12} totalDays={30} size={160} label="days" />,
  },
  {
    key: 'remind',
    title: 'Reminded before it’s too late',
    body: 'Boughtly nudges you before a return window closes and before a warranty expires — that’s the whole point. On the next screen, iOS will ask permission to send those reminders.',
    art: (
      <View style={styles_art.bell}>
        <Ionicons name="notifications" size={72} color={colors.coral} />
      </View>
    ),
  },
];

export function OnboardingScreen({ navigation }: Props) {
  const { updateSettings } = useAppState();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const isLast = page === SLIDES.length - 1;

  async function finish(withReminders: boolean) {
    successFeedback();
    // Ask for notification permission only AFTER the slide explained why —
    // people who see the reason first say yes far more often.
    if (withReminders) {
      const granted = await ensureNotificationSetup();
      await updateSettings({ hasOnboarded: true, notificationsEnabled: granted });
    } else {
      await updateSettings({ hasOnboarded: true });
    }
    navigation.replace('Tabs');
  }

  function next() {
    if (isLast) {
      void finish(true);
    } else {
      const target = page + 1;
      listRef.current?.scrollToIndex({ index: target, animated: true });
      setPage(target); // momentum event doesn't fire on programmatic scrolls
    }
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.skip} onPress={() => void finish(false)} hitSlop={12}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.art}>{item.art}</View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <Button
          title={isLast ? 'Turn on reminders' : 'Next'}
          variant={isLast ? 'coral' : 'primary'}
          onPress={next}
        />
        {isLast && (
          <Pressable onPress={() => void finish(false)} hitSlop={8} style={styles.later}>
            <Text style={styles.laterText}>Not now — I’ll decide later</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skip: {
    position: 'absolute',
    top: 64,
    right: spacing.lg,
    zIndex: 2,
  },
  skipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.muted,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  art: {
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    color: colors.deepBlue,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl + spacing.md,
    gap: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.divider,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 22,
  },
  later: {
    alignSelf: 'center',
    marginTop: -spacing.sm,
  },
  laterText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
  },
});
