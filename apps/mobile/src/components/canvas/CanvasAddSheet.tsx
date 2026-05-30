import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, Text, View, useColorScheme } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (type: string) => void;
}

const NODE_TYPES = [
  { type: 'text',  label: 'Text Card',  icon: 'file-text' as const },
  { type: 'file',  label: 'Note',       icon: 'book-open' as const },
  { type: 'image', label: 'Image',      icon: 'image' as const },
  { type: 'link',  label: 'Link',       icon: 'link' as const },
  { type: 'group', label: 'Group',      icon: 'square' as const },
];

export function CanvasAddSheet({ visible, onClose, onAdd }: Props) {
  const dark = useColorScheme() === 'dark';
  const bg = dark ? '#25262b' : '#ffffff';
  const textColor = dark ? '#c1c2c5' : '#212529';
  const border = dark ? '#373a40' : '#e9ecef';
  const bgSubtle = dark ? '#1a1b1e' : '#f8f9fa';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: bg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: 40,
          }}
        >
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: border, alignSelf: 'center', marginTop: 12, marginBottom: 16 }} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: textColor, paddingHorizontal: 20, paddingBottom: 16 }}>
            Add to Canvas
          </Text>
          {NODE_TYPES.map(({ type, label, icon }) => (
            <Pressable
              key={type}
              onPress={() => onAdd(type)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 14,
                gap: 16,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: bgSubtle, borderWidth: 1, borderColor: border, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name={icon} size={18} color="#4263eb" />
              </View>
              <Text style={{ fontSize: 15, color: textColor }}>{label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
