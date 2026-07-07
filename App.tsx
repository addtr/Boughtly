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
import { ItemDetailScreen } from './src/screens/ItemDetailScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { AppStateProvider, useAppState } from './src/store/AppStateContext';
import { colors, fonts } from './src/theme/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.deepBlue,
    primary: colors.primary,
  },
};

function openItemFromNotification(response: Notifications.NotificationResponse) {
  const itemId = response.notification.request.content.data?.itemId;
  if (typeof itemId === 'string' && navigationRef.isReady()) {
    navigationRef.navigate('ItemDetail', { itemId });
  }
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
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName={settings.hasOnboarded ? 'Tabs' : 'Onboarding'}
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
              : 'Add an item',
          })}
        />
        <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: '' }} />
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
