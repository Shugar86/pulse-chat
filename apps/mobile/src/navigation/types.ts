export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
};

export type TenantStackParamList = {
  TenantSelection: undefined;
  CreateTenant: undefined;
  JoinTenant: undefined;
  TenantInvite: { tenantId: string };
};

export type ChatStackParamList = {
  ChatsList: undefined;
  Chat: { chatId: string; title: string };
};

export type MainStackParamList = {
  MainTabs: undefined;
  Call: { userId: string; displayName: string };
};
