import type { ImageCanvasNode } from '@nodeira/shared-types';
import { Image } from 'expo-image';

interface Props {
  node: ImageCanvasNode;
}

export function ImageNode({ node }: Props) {
  return (
    <Image
      source={{ uri: node.url }}
      style={{ flex: 1, borderRadius: 6 }}
      contentFit="contain"
    />
  );
}
