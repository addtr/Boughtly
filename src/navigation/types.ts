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
  ScanReview: {
    storeName: string;
    purchaseDate: string;
    returnDays: number | null;
    receiptImageUri: string | null;
    items: { name: string; price: number }[];
  };
  ItemDetail: { itemId: string };
  AddWatch: { prefillName?: string } | undefined;
  WatchDetail: { watchId: string };
  ReturnDetail: { returnId: string };
};
