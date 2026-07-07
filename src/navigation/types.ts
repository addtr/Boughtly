import { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  WatchTab: undefined;
  AddTab: undefined; // never actually visited — its tab button opens AddChooser
  ReturnsTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  AddChooser: undefined;
  AddItem: { mode?: 'scan' | 'manual'; itemId?: string } | undefined;
  ItemDetail: { itemId: string };
  AddWatch: undefined;
  WatchDetail: { watchId: string };
  ReturnDetail: { returnId: string };
};
