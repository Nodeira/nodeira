import type { CanvasNodeSide } from '@nodeira/shared-types';
import { Pressable, View } from 'react-native';
import type { PendingConnection } from './CanvasView';

interface Props {
  nodeId: string;
  nodeWidth: number;
  nodeHeight: number;
  pendingConnection: PendingConnection | null;
  onHandleTap: (nodeId: string, side: CanvasNodeSide) => void;
}

const TOUCH_SIZE = 24;
const DOT_SIZE = 8;

interface HandleConfig {
  side: CanvasNodeSide;
  style: object;
}

export function CanvasHandles({ nodeId, nodeWidth, nodeHeight, pendingConnection, onHandleTap }: Props) {
  const handles: HandleConfig[] = [
    {
      side: 'top',
      style: {
        position: 'absolute' as const,
        top: -(TOUCH_SIZE / 2),
        left: nodeWidth / 2 - TOUCH_SIZE / 2,
        width: TOUCH_SIZE,
        height: TOUCH_SIZE,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
    },
    {
      side: 'right',
      style: {
        position: 'absolute' as const,
        top: nodeHeight / 2 - TOUCH_SIZE / 2,
        right: -(TOUCH_SIZE / 2),
        width: TOUCH_SIZE,
        height: TOUCH_SIZE,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
    },
    {
      side: 'bottom',
      style: {
        position: 'absolute' as const,
        bottom: -(TOUCH_SIZE / 2),
        left: nodeWidth / 2 - TOUCH_SIZE / 2,
        width: TOUCH_SIZE,
        height: TOUCH_SIZE,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
    },
    {
      side: 'left',
      style: {
        position: 'absolute' as const,
        top: nodeHeight / 2 - TOUCH_SIZE / 2,
        left: -(TOUCH_SIZE / 2),
        width: TOUCH_SIZE,
        height: TOUCH_SIZE,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      },
    },
  ];

  return (
    <>
      {handles.map(({ side, style }) => {
        const isSource = pendingConnection?.fromNodeId === nodeId && pendingConnection.fromSide === side;
        const isPending = pendingConnection !== null;
        const dotColor = isSource ? '#4263eb' : isPending ? '#4263eb88' : '#868e96';
        return (
          <Pressable
            key={side}
            style={style}
            onPress={() => onHandleTap(nodeId, side)}
            hitSlop={4}
          >
            <View
              style={{
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: DOT_SIZE / 2,
                backgroundColor: dotColor,
                borderWidth: 1.5,
                borderColor: '#fff',
              }}
            />
          </Pressable>
        );
      })}
    </>
  );
}
