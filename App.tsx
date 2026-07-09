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
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Tabs } from './src/navigation/Tabs';
import { RootStackParamList } from './src/navigation/types';
import { AddChooserScreen } from './src/screens/AddChooserScreen';
import { AddItemScreen } from './src/screens/AddItemScreen';
import { AddWatchScreen } from './src/screens/AddWatchScreen';
import { BarcodeScanScreen } from './src/screens/BarcodeScanScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { ItemDetailScreen } from './src/screens/ItemDetailScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PasteReceiptScreen } from './src/screens/PasteReceiptScreen';
import { ReturnDetailScreen } from './src/screens/ReturnDetailScreen';
import { ScanReviewScreen } from './src/screens/ScanReviewScreen';
import { WatchDetailScreen } from './src/screens/WatchDetailScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { AppStateProvider, useAppState } from './src/store/AppStateContext';
import { colors, fonts, isDarkMode } from './src/theme/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  dark: isDarkMode,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.deepBlue,
    primary: colors.primary,
    border: colors.divider,
  },
};

// If a notification is tapped before navigation is mounted (cold start),
// hold the jump until the container reports ready.
let pendingNotificationNav: (() => void) | null = null;

function openItemFromNotification(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data ?? {};
  let go: (() => void) | null = null;
  if (typeof data.returnId === 'string') {
    const returnId = data.returnId;
    go = () => navigationRef.navigate('ReturnDetail', { returnId });
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
  const { isLoaded, settings } = useAppState();
  const [fontsLoaded] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded || !isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={flushPendingNotificationNav}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
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
          name="Insights"
          component={InsightsScreen}
          options={{ title: 'Your spending' }}
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <Root />
    </AppStateProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
