export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
};

export type ChatStackParamList = {
  ChatsList: undefined;
  Chat: { chatId: string; title: string };
};
