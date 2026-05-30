import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View, useColorScheme } from 'react-native';

type Tool =
  | { id: string; type: 'text'; label: string; group: number }
  | { id: string; type: 'mci'; icon: string; group: number }
  | { id: string; type: 'feather'; icon: string; group: number };

const TOOLS: Tool[] = [
  { id: 'h1', type: 'text', label: 'H1', group: 0 },
  { id: 'h2', type: 'text', label: 'H2', group: 0 },
  { id: 'h3', type: 'text', label: 'H3', group: 0 },
  { id: 'bold', type: 'mci', icon: 'format-bold', group: 1 },
  { id: 'italic', type: 'mci', icon: 'format-italic', group: 1 },
  { id: 'strike', type: 'mci', icon: 'format-strikethrough', group: 1 },
  { id: 'code', type: 'feather', icon: 'code', group: 1 },
  { id: 'link', type: 'feather', icon: 'link', group: 2 },
  { id: 'ul', type: 'mci', icon: 'format-list-bulleted', group: 3 },
  { id: 'ol', type: 'mci', icon: 'format-list-numbered', group: 3 },
  { id: 'check', type: 'mci', icon: 'checkbox-marked-outline', group: 3 },
  { id: 'quote', type: 'mci', icon: 'format-quote-close', group: 4 },
  { id: 'table', type: 'mci', icon: 'table-large', group: 4 },
  { id: 'undo', type: 'feather', icon: 'rotate-ccw', group: 5 },
  { id: 'photo', type: 'feather', icon: 'image', group: 6 },
  { id: 'camera', type: 'feather', icon: 'camera', group: 6 },
];

// Pre-compute separator positions
type ToolItem = { sep: false; tool: Tool } | { sep: true; key: string };
const ITEMS: ToolItem[] = TOOLS.reduce<ToolItem[]>((acc, tool) => {
  if (acc.length > 0) {
    const last = acc.filter((t): t is { sep: false; tool: Tool } => !t.sep).at(-1);
    if (last && last.tool.group !== tool.group) {
      acc.push({ sep: true, key: `sep-${tool.id}` });
    }
  }
  acc.push({ sep: false, tool });
  return acc;
}, []);

interface FormattingToolbarProps {
  onAction?: (id: string) => void;
}

export function FormattingToolbar({ onAction }: FormattingToolbarProps) {
  const dark = useColorScheme() === 'dark';
  const bg = dark ? '#25262b' : '#f8f9fa';
  const borderColor = dark ? '#373a40' : '#e9ecef';
  const btnBg = dark ? '#373a40' : '#ffffff';
  const iconColor = dark ? '#c1c2c5' : '#495057';

  return (
    <View
      style={{
        backgroundColor: bg,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor,
        paddingVertical: 6,
        paddingHorizontal: 8,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
        keyboardShouldPersistTaps="always"
      >
        {ITEMS.map((item) => {
          if (item.sep) {
            return (
              <View
                key={item.key}
                style={{ width: 1, height: 22, backgroundColor: borderColor, marginHorizontal: 4 }}
              />
            );
          }
          const { tool } = item;
          return (
            <Pressable
              key={tool.id}
              onPress={() => onAction?.(tool.id)}
              style={{
                minWidth: 32,
                height: 32,
                paddingHorizontal: 6,
                borderWidth: 1,
                borderColor,
                borderRadius: 6,
                backgroundColor: btnBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {tool.type === 'text' ? (
                <Text style={{ fontWeight: '600', fontSize: 13, color: iconColor }}>
                  {tool.label}
                </Text>
              ) : tool.type === 'mci' ? (
                <MaterialCommunityIcons name={tool.icon as any} size={16} color={iconColor} />
              ) : (
                <Feather name={tool.icon as any} size={14} color={iconColor} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
