import { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  WatchTab: undefined;
  AddTab: undefined; // never actually visited — its tab button opens AddChooser
  ReturnsTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  Onboarding: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  AddChooser: undefined;
  PasteReceipt: undefined;
  BarcodeScan: undefined;
  AddItem: {
    mode?: 'scan' | 'manual' | 'photo' | 'barcode';
    itemId?: string;
    scanText?: string;
  } | undefined;
  ScanReview: {
    storeName: string;
    purchaseDate: string;
    returnDays: number | null;
    receiptImageUri: string | null;
    total: number | null;
    items: { name: string; price: number }[];
  };
  ItemDetail: { itemId: string };
  Insights: undefined;
  Reminders: undefined;
  StoreProfile: { storeName: string };
  AddWatch: { prefillName?: string } | undefined;
  WatchDetail: { watchId: string };
  ReturnDetail: { returnId: string };
};
