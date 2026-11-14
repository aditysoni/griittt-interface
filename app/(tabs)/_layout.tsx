import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../components/ThemeContext';

const TABS = [
  { name: 'index',      label: 'Today',    icon: 'grid-outline'      as const },
  { name: 'fuel',       label: 'Food',     icon: 'nutrition-outline' as const },
  { name: 'strength',   label: 'Physical', icon: 'barbell-outline'   as const },
  { name: 'challenges', label: 'Grind',    icon: 'flag-outline'      as const },
  { name: 'profile',    label: 'You',      icon: 'person-outline'    as const },
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
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
          >
            {focused ? (
              <View style={[tb.pill, { backgroundColor: theme.text }]}>
                <Ionicons name={tab.icon} size={20} color={theme.bg} />
              </View>
            ) : (
              <Ionicons name={tab.icon} size={20} color={theme.textSecondary} style={{ opacity: 0.5 }} />
            )}
            <Text
              style={[tb.label, { color: focused ? theme.text : theme.textSecondary, fontFamily: focused ? 'Inter_700Bold' : 'Inter_600SemiBold' }]}
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
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
    paddingBottom: Platform.OS === 'ios' ? 22 : 12,
    paddingTop: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 48,
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  label: { fontSize: 10, letterSpacing: 0.2 },
});

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'shift' }}
    >
      {TABS.map(t => <Tabs.Screen key={t.name} name={t.name} />)}
      <Tabs.Screen name="ai" options={{ href: null }} />
      <Tabs.Screen name="mirror" options={{ href: null }} />
    </Tabs>
  );
}
