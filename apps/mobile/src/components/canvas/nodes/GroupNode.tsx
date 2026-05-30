import type { GroupCanvasNode } from '@nodeira/shared-types';
import { TextInput, View, useColorScheme } from 'react-native';

interface Props {
  node: GroupCanvasNode;
  onDataChange: (patch: Record<string, unknown>) => void;
}

export function GroupNode({ node, onDataChange }: Props) {
  const dark = useColorScheme() === 'dark';
  const textColor = dark ? '#c1c2c5' : '#212529';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'rgba(66, 99, 235, 0.08)',
        borderWidth: 2,
        borderColor: 'rgba(66, 99, 235, 0.4)',
        borderStyle: 'dashed',
        borderRadius: 8,
        padding: 8,
      }}
    >
      <TextInput
        value={node.label ?? ''}
        onChangeText={(label) => onDataChange({ label })}
        placeholder="Group"
        placeholderTextColor="#4263eb88"
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: '#4263eb',
        }}
      />
    </View>
  );
}
