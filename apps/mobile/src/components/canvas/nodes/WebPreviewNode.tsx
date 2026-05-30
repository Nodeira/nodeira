import type { LinkCanvasNode } from '@nodeira/shared-types';
import { Image } from 'expo-image';
import { Linking, Pressable, Text, View, useColorScheme } from 'react-native';

interface Props {
  node: LinkCanvasNode;
}

export function WebPreviewNode({ node }: Props) {
  const dark = useColorScheme() === 'dark';
  const bg = dark ? '#25262b' : '#ffffff';
  const textColor = dark ? '#c1c2c5' : '#212529';
  const textMute = '#868e96';
  const border = dark ? '#373a40' : '#e9ecef';

  const preview = node.preview;

  return (
    <Pressable
      onPress={() => Linking.openURL(node.url)}
      style={{ flex: 1, backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 8, overflow: 'hidden' }}
    >
      {preview?.image ? (
        <Image
          source={{ uri: preview.image }}
          style={{ width: '100%', height: 80 }}
          contentFit="cover"
        />
      ) : null}

      <View style={{ padding: 8, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          {preview?.favicon ? (
            <Image
              source={{ uri: preview.favicon }}
              style={{ width: 14, height: 14, borderRadius: 2 }}
              contentFit="contain"
            />
          ) : null}
          <Text style={{ fontSize: 12, fontWeight: '600', color: textColor, flex: 1 }} numberOfLines={1}>
            {preview?.title ?? node.url}
          </Text>
        </View>
        {preview?.description ? (
          <Text style={{ fontSize: 11, color: textMute }} numberOfLines={2}>
            {preview.description}
          </Text>
        ) : (
          <Text style={{ fontSize: 11, color: textMute }} numberOfLines={1}>{node.url}</Text>
        )}
      </View>
    </Pressable>
  );
}
