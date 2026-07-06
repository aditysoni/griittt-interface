import { Tabs } from 'expo-router';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../components/ThemeContext';

const TABS = [
  { name: 'index',      label: 'INDEX',    icon: 'grid-outline'      as const },
  { name: 'fuel',       label: 'FUEL',     icon: 'nutrition-outline' as const },
  { name: 'strength',   label: 'STRENGTH', icon: 'barbell-outline'   as const },
  { name: 'challenges', label: 'GRIND',    icon: 'flag-outline'      as const },
  { name: 'mirror',     label: 'MIRROR',   icon: 'eye-outline'       as const },
  { name: 'profile',    label: 'YOU',      icon: 'person-outline'    as const },
];

function TabBar({ state, navigation }: any) {
  const { theme } = useTheme();

  return (
    <View style={[tb.root, { backgroundColor: theme.bg, borderTopColor: theme.border }]}>
      {TABS.map((tab) => {
        const route = state.routes.find((r: any) => r.name === tab.name);
        if (!route) return null;
        const idx     = state.routes.indexOf(route);
        const focused = state.index === idx;

        return (
          <TouchableOpacity
            key={tab.name}
            style={tb.btn}
            onPress={() => navigation.navigate(tab.name)}
            activeOpacity={0.7}
          >
            {focused ? (
              <View style={[tb.pill, { backgroundColor: theme.text }]}>
                <Ionicons name={tab.icon} size={22} color={theme.bg} />
              </View>
            ) : (
              <Ionicons name={tab.icon} size={22} color={theme.textSecondary} style={{ opacity: 0.4 }} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tb = StyleSheet.create({
  root: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    paddingTop: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 16,
  },
});

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TABS.map(t => <Tabs.Screen key={t.name} name={t.name} />)}
      <Tabs.Screen name="ai" options={{ href: null }} />
      <Tabs.Screen name="fuel-analysis" options={{ href: null }} />
      <Tabs.Screen name="building-you" options={{ href: null }} />
    </Tabs>
  );
}
