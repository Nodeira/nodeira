import type { CanvasNode, CanvasNodeSide } from '@nodeira/shared-types';
import { Alert, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { CanvasHandles } from './CanvasHandles';
import { TextCardNode } from './nodes/TextCardNode';
import { NoteCardNode } from './nodes/NoteCardNode';
import { WebPreviewNode } from './nodes/WebPreviewNode';
import { GroupNode } from './nodes/GroupNode';
import { ImageNode } from './nodes/ImageNode';
import type { PendingConnection } from './CanvasView';

interface Props {
  node: CanvasNode;
  selected: boolean;
  readOnly: boolean;
  pendingConnection: PendingConnection | null;
  canvasScale: SharedValue<number>;
  onSelect: () => void;
  onDragEnd: (nodeId: string, x: number, y: number) => void;
  onDataChange: (nodeId: string, patch: Record<string, unknown>) => void;
  onDelete: (nodeId: string) => void;
  onHandleTap: (nodeId: string, side: CanvasNodeSide) => void;
}

function renderNodeContent(
  node: CanvasNode,
  onDataChange: (patch: Record<string, unknown>) => void,
) {
  switch (node.type) {
    case 'text':
      return <TextCardNode node={node} onDataChange={onDataChange} />;
    case 'file':
      return <NoteCardNode node={node} />;
    case 'link':
      return <WebPreviewNode node={node} />;
    case 'group':
      return <GroupNode node={node} onDataChange={onDataChange} />;
    case 'image':
      return <ImageNode node={node} />;
    default:
      return null;
  }
}

export function CanvasNodeWrapper({
  node,
  selected,
  readOnly,
  pendingConnection,
  canvasScale,
  onSelect,
  onDragEnd,
  onDataChange,
  onDelete,
  onHandleTap,
}: Props) {
  // Shared values for smooth drag
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const commitDrag = (x: number, y: number) => {
    onDragEnd(node.id, node.x + x, node.y + y);
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
      dragX.value = 0;
      dragY.value = 0;
    })
    .onUpdate((e) => {
      dragX.value = e.translationX / canvasScale.value;
      dragY.value = e.translationY / canvasScale.value;
    })
    .onEnd(() => {
      isDragging.value = false;
      runOnJS(commitDrag)(dragX.value, dragY.value);
      dragX.value = 0;
      dragY.value = 0;
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(onSelect)();
  });

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      runOnJS(showNodeMenu)();
    });

  function showNodeMenu() {
    Alert.alert(node.type === 'text' ? 'Text Card' : 'Node', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDelete(node.id),
      },
    ]);
  }

  const gesture = readOnly
    ? tapGesture
    : Gesture.Simultaneous(panGesture, tapGesture, longPressGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
    ],
    zIndex: isDragging.value ? 100 : selected ? 10 : 1,
  }));

  const borderColor = selected ? '#4263eb' : 'transparent';

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: node.x,
            top: node.y,
            width: node.width,
            height: node.height,
          },
          animatedStyle,
        ]}
      >
        <View
          style={{
            flex: 1,
            borderWidth: selected ? 2 : 0,
            borderColor,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {renderNodeContent(node, (patch) => onDataChange(node.id, patch))}
        </View>

        {!readOnly && (
          <CanvasHandles
            nodeId={node.id}
            nodeWidth={node.width}
            nodeHeight={node.height}
            pendingConnection={pendingConnection}
            onHandleTap={onHandleTap}
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
}
