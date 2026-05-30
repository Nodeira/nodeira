import { Feather } from '@expo/vector-icons';
import { Appearance, Pressable, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TopBarProps {
  title?: string;
  onMenu?: () => void;
  onBack?: () => void;
  onSettings?: () => void;
}

export function TopBar({ title = 'Nodeira', onMenu, onBack, onSettings }: TopBarProps) {
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  function toggleTheme() {
    Appearance.setColorScheme(dark ? 'light' : 'dark');
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: insets.top + 8,
        paddingBottom: 8,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: dark ? '#373a40' : '#e9ecef',
        backgroundColor: dark ? '#1a1b1e' : '#ffffff',
      }}
    >
      {onMenu && (
        <Pressable
          onPress={onMenu}
          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
          hitSlop={8}
        >
          <Feather name="menu" size={18} color={dark ? '#c1c2c5' : '#495057'} />
        </Pressable>
      )}
      {onBack && (
        <Pressable
          onPress={onBack}
          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color="#4263eb" />
        </Pressable>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            backgroundColor: '#4263eb',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>N</Text>
        </View>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: dark ? '#ffffff' : '#212529',
            letterSpacing: -0.1,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      <Pressable
        onPress={toggleTheme}
        style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
        hitSlop={8}
      >
        <Feather name={dark ? 'sun' : 'moon'} size={16} color={dark ? '#c1c2c5' : '#495057'} />
      </Pressable>
      {onSettings && (
        <Pressable
          onPress={onSettings}
          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
          hitSlop={8}
        >
          <Feather name="settings" size={16} color={dark ? '#c1c2c5' : '#495057'} />
        </Pressable>
      )}
    </View>
  );
}
