import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'grittt_token';
export const USER_KEY = 'grittt_user';
export const ONBOARDING_KEY = 'grittt_onboarding_done';

export const storage = {
  getToken: () => AsyncStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => AsyncStorage.setItem(TOKEN_KEY, token),
  removeToken: () => AsyncStorage.removeItem(TOKEN_KEY),
  getUser: async () => {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },
  setUser: (user: object) => AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
  removeUser: () => AsyncStorage.removeItem(USER_KEY),
  getOnboardingDone: async () => (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'true',
  setOnboardingDone: () => AsyncStorage.setItem(ONBOARDING_KEY, 'true'),
  clear: async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, ONBOARDING_KEY]);
  },
};
