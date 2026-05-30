import { useAtomValue } from 'jotai';
import { Text, View } from 'react-native';

import { networkStatusAtom } from '@/store/atoms';

export function OfflineBanner() {
  const status = useAtomValue(networkStatusAtom);
  if (status === 'online') return null;
  return (
    <View className="bg-red-700 py-1.5 items-center">
      <Text className="text-white text-sm font-semibold">No internet connection</Text>
    </View>
  );
}
