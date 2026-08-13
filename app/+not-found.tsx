import React from 'react';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, AppTheme } from '../components/ThemeContext';

export default function NotFoundScreen() {
  const { theme } = useTheme();
  const s = React.useMemo(() => makeStyles(theme), [theme]);

  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={s.container}>
        <Text style={s.title}>This screen doesn't exist.</Text>
        <Link href="/" style={s.link}>
          <Text style={s.linkText}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}

function makeStyles(t: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg },
    title: { fontSize: 20, fontWeight: 'bold', color: t.text },
    link: { marginTop: 16 },
    linkText: { color: t.accent, fontSize: 16 },
  });
}
