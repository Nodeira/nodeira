import type { TextCanvasNode } from '@nodeira/shared-types';
import { TextInput, View, useColorScheme } from 'react-native';

interface Props {
  node: TextCanvasNode;
  onDataChange: (patch: Record<string, unknown>) => void;
}

export function TextCardNode({ node, onDataChange }: Props) {
  const dark = useColorScheme() === 'dark';
  const bg = dark ? '#25262b' : '#ffffff';
  const textColor = dark ? '#c1c2c5' : '#212529';
  const border = dark ? '#373a40' : '#e9ecef';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        borderRadius: 8,
        padding: 8,
      }}
    >
      <TextInput
        value={node.text}
        onChangeText={(text) => onDataChange({ text })}
        placeholder="Type something…"
        placeholderTextColor="#868e96"
        multiline
        style={{ flex: 1, fontSize: 13, color: textColor, textAlignVertical: 'top' }}
      />
    </View>
  );
}
