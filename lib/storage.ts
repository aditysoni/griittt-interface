import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'grittt_token';
export const USER_KEY = 'grittt_user';

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
  clear: async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  },
};
