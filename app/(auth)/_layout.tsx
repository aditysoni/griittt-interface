import { Stack } from 'expo-router';
import { useTheme } from '../../components/ThemeContext';

export default function AuthLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
        animation: 'fade',
      }}
    />
  );
}
