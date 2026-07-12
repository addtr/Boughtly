import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import {
  createNavigationContainerRef,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardDoneBar } from './src/components/KeyboardDoneBar';
import { LockScreen } from './src/components/LockScreen';
import { ToastProvider } from './src/components/Toast';
import { Tabs } from './src/navigation/Tabs';
import { RootStackParamList } from './src/navigation/types';
import { AddChooserScreen } from './src/screens/AddChooserScreen';
import { AddItemScreen } from './src/screens/AddItemScreen';
import { AddWatchScreen } from './src/screens/AddWatchScreen';
import { BarcodeScanScreen } from './src/screens/BarcodeScanScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { ItemDetailScreen } from './src/screens/ItemDetailScreen';
import { LegalScreen } from './src/screens/LegalScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PasteReceiptScreen } from './src/screens/PasteReceiptScreen';
import { PlusScreen } from './src/screens/PlusScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AddSubscriptionScreen } from './src/screens/AddSubscriptionScreen';
import { RegisterProductScreen } from './src/screens/RegisterProductScreen';
import { RemindersScreen } from './src/screens/RemindersScreen';
import { SubscriptionsScreen } from './src/screens/SubscriptionsScreen';
import { ReturnDetailScreen } from './src/screens/ReturnDetailScreen';
import { ScanReviewScreen } from './src/screens/ScanReviewScreen';
import { StoreProfileScreen } from './src/screens/StoreProfileScreen';
import { WatchDetailScreen } from './src/screens/WatchDetailScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { initAds } from './src/services/ads';
import { AppStateProvider, useAppState } from './src/store/AppStateContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { fonts } from './src/theme/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// If a notification is tapped before navigation is mounted (cold start),
// hold the jump until the container reports ready.
let pendingNotificationNav: (() => void) | null = null;

function openItemFromNotification(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data ?? {};
  let go: (() => void) | null = null;
  if (typeof data.returnId === 'string') {
    const returnId = data.returnId;
    go = () => navigationRef.navigate('ReturnDetail', { returnId });
  } else if (typeof data.subscriptionId === 'string') {
    go = () => navigationRef.navigate('Subscriptions');
  } else if (typeof data.itemId === 'string') {
    const itemId = data.itemId;
    go = () => navigationRef.navigate('ItemDetail', { itemId });
  } else if (data.openTab === 'watch') {
    go = () => navigationRef.navigate('Tabs', { screen: 'WatchTab' });
  }
  if (!go) return;
  if (navigationRef.isReady()) {
    go();
  } else {
    pendingNotificationNav = go;
  }
}

function flushPendingNotificationNav() {
  pendingNotificationNav?.();
  pendingNotificationNav = null;
}

/** Tapping a reminder lands on that item's detail screen. */
function useNotificationTaps() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // App was cold-launched from a notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openItemFromNotification(response);
    });
    const sub = Notifications.addNotificationResponseReceivedListener(openItemFromNotification);
    return () => sub.remove();
  }, []);
}

function Root() {
  useNotificationTaps();
  // Initialize the ad SDK once (no-op while ads are disabled).
  useEffect(() => {
    void initAds();
  }, []);
  const { isLoaded, settings } = useAppState();
  const { colors, isDark } = useTheme();
  // Rebuilt on theme change so navigator chrome (headers, backgrounds,
  // transitions) restyles instantly along with the screens.
  const navTheme = React.useMemo(
    () => ({
      ...DefaultTheme,
      dark: isDark,
      colors: {
        ...DefaultTheme.colors,
        background: colors.background,
        card: colors.background,
        text: colors.deepBlue,
        primary: colors.primary,
        border: colors.divider,
      },
    }),
    [colors, isDark]
  );
  const [fontsLoaded] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // App lock: gate the UI until Face ID/passcode succeeds. Locks at launch
  // (when enabled) and again after the app has been backgrounded; enabling
  // the toggle mid-session does NOT lock the session you're already in.
  const lockSupported = Platform.OS !== 'web';
  const [locked, setLocked] = useState<boolean | null>(null);
  const lockEnabledRef = useRef(false);
  lockEnabledRef.current = lockSupported && settings.appLockEnabled;
  useEffect(() => {
    // Decide the initial lock state once settings have loaded.
    if (isLoaded && locked === null) setLocked(lockEnabledRef.current);
  }, [isLoaded, locked]);
  useEffect(() => {
    // Turning the lock off always unlocks.
    if (!settings.appLockEnabled && locked) setLocked(false);
  }, [settings.appLockEnabled, locked]);
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    if (!lockSupported) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (
        appStateRef.current === 'active' &&
        next.match(/inactive|background/) &&
        lockEnabledRef.current
      ) {
        setLocked(true); // returning requires auth again
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [lockSupported]);

  if (!fontsLoaded || !isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={flushPendingNotificationNav}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* One shared "Done" bar above the keyboard (iOS) for every input */}
      <KeyboardDoneBar />
      <Stack.Navigator
        initialRouteName={
          !settings.accountEmail
            ? 'Welcome'
            : settings.hasOnboarded
            ? 'Tabs'
            : 'Onboarding'
        }
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.deepBlue,
          headerTitleStyle: {
            fontFamily: fonts.display,
            fontSize: 18,
            color: colors.deepBlue,
          },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="AddChooser"
          component={AddChooserScreen}
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="AddItem"
          component={AddItemScreen}
          options={({ route }) => ({
            title: route.params?.itemId
              ? 'Edit item'
              : route.params?.mode === 'scan'
              ? 'Scan a receipt'
              : route.params?.mode === 'photo'
              ? 'Upload a receipt'
              : route.params?.mode === 'barcode'
              ? 'Scan a barcode'
              : 'Add an item',
          })}
        />
        <Stack.Screen
          name="PasteReceipt"
          component={PasteReceiptScreen}
          options={{ title: 'Paste a receipt' }}
        />
        <Stack.Screen
          name="BarcodeScan"
          component={BarcodeScanScreen}
          options={{ title: 'Scan a barcode' }}
        />
        <Stack.Screen
          name="ScanReview"
          component={ScanReviewScreen}
          options={{ title: 'Review your receipt' }}
        />
        <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: '' }} />
        <Stack.Screen
          name="RegisterProduct"
          component={RegisterProductScreen}
          options={{ title: 'Register product' }}
        />
        <Stack.Screen
          name="Insights"
          component={InsightsScreen}
          options={{ title: 'Your spending' }}
        />
        <Stack.Screen
          name="Reminders"
          component={RemindersScreen}
          options={{ title: 'Upcoming reminders' }}
        />
        <Stack.Screen
          name="StoreProfile"
          component={StoreProfileScreen}
          options={{ title: '' }}
        />
        <Stack.Screen
          name="AddWatch"
          component={AddWatchScreen}
          options={{ title: 'Watch a price' }}
        />
        <Stack.Screen
          name="WatchDetail"
          component={WatchDetailScreen}
          options={{ title: '' }}
        />
        <Stack.Screen
          name="ReturnDetail"
          component={ReturnDetailScreen}
          options={{ title: 'Return' }}
        />
        <Stack.Screen
          name="Subscriptions"
          component={SubscriptionsScreen}
          options={{ title: 'Subscriptions' }}
        />
        <Stack.Screen
          name="AddSubscription"
          component={AddSubscriptionScreen}
          options={({ route }) => ({
            title: route.params?.subscriptionId ? 'Edit subscription' : 'Add subscription',
          })}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Edit profile' }}
        />
        <Stack.Screen
          name="Plus"
          component={PlusScreen}
          options={{ title: 'Boughtly Plus', presentation: 'modal' }}
        />
        <Stack.Screen
          name="Legal"
          component={LegalScreen}
          options={({ route }) => ({
            title: route.params?.doc === 'privacy' ? 'Privacy Policy' : 'Terms & Disclaimer',
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <AppStateProvider>
        <ThemeProvider>
          <ToastProvider>
            <Root />
          </ToastProvider>
        </ThemeProvider>
      </AppStateProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
