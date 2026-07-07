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
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RootStackParamList } from './src/navigation/types';
import { AddItemScreen } from './src/screens/AddItemScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ItemDetailScreen } from './src/screens/ItemDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AppStateProvider } from './src/store/AppStateContext';
import { colors, fonts } from './src/theme/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

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

export default function App() {
  useNotificationTaps();
  const [fontsLoaded] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <AppStateProvider>
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        <StatusBar style="dark" />
        <Stack.Navigator
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
            name="Dashboard"
            component={DashboardScreen}
            options={({ navigation }) => ({
              title: 'Boughtly',
              headerTitleStyle: {
                fontFamily: fonts.displayBold,
                fontSize: 22,
                color: colors.deepBlue,
              },
              headerRight: () => (
                <Pressable
                  onPress={() => navigation.navigate('Settings')}
                  hitSlop={12}
                  accessibilityLabel="Settings"
                >
                  <Text style={styles.gear}>⚙️</Text>
                </Pressable>
              ),
            })}
          />
          <Stack.Screen
            name="AddItem"
            component={AddItemScreen}
            options={({ route }) => ({
              title: route.params?.itemId ? 'Edit item' : 'Add an item',
            })}
          />
          <Stack.Screen
            name="ItemDetail"
            component={ItemDetailScreen}
            options={{ title: '' }}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </Stack.Navigator>
      </NavigationContainer>
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
  gear: {
    fontSize: 20,
  },
});
