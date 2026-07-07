import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ReturnsScreen } from '../screens/ReturnsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { WatchListScreen } from '../screens/WatchListScreen';
import { cardShadow, colors, fonts } from '../theme/theme';
import { tapFeedback } from '../utils/haptics';
import { RootStackParamList, TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

/** Placeholder — the Add tab never renders; its button opens the chooser. */
function NullScreen() {
  return null;
}

function AddButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={styles.addWrap} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          tapFeedback();
          navigation.navigate('AddChooser');
        }}
        accessibilityLabel="Add an item"
        style={({ pressed }) => [styles.addButton, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Ionicons name="add" size={34} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

export function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: fonts.display,
          fontSize: 18,
          color: colors.deepBlue,
        },
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: fonts.bodyMedium,
          fontSize: 11,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          title: 'Boughtly',
          headerTitleStyle: {
            fontFamily: fonts.displayBold,
            fontSize: 22,
            color: colors.deepBlue,
          },
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="WatchTab"
        component={WatchListScreen}
        options={{
          title: 'Price watch',
          tabBarLabel: 'Prices',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'pricetags' : 'pricetags-outline'}
              size={23}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="AddTab"
        component={NullScreen}
        options={{
          tabBarLabel: '',
          tabBarButton: () => <AddButton />,
        }}
      />
      <Tab.Screen
        name="ReturnsTab"
        component={ReturnsScreen}
        options={{
          title: 'Returns',
          tabBarLabel: 'Returns',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'arrow-undo' : 'arrow-undo-outline'}
              size={23}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={23} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopWidth: 0,
    height: 84,
    paddingTop: 8,
    ...cardShadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    elevation: 12,
  },
  addWrap: {
    flex: 1,
    alignItems: 'center',
  },
  addButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    ...cardShadow,
    shadowOpacity: 0.3,
    elevation: 8,
  },
});
