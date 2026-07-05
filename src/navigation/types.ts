export type RootStackParamList = {
  Dashboard: undefined;
  AddItem: { itemId?: string } | undefined; // itemId present = editing
  ItemDetail: { itemId: string };
  Settings: undefined;
};
