import type { OgPreview } from '@nodeira/shared-types';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (url: string, preview: OgPreview) => void;
  fetchPreview: (url: string) => Promise<OgPreview>;
}

export function AddLinkModal({ visible, onClose, onConfirm, fetchPreview }: Props) {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<OgPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dark = useColorScheme() === 'dark';
  const bg = dark ? '#1a1b1e' : '#ffffff';
  const bgSubtle = dark ? '#25262b' : '#f8f9fa';
  const textColor = dark ? '#c1c2c5' : '#212529';
  const textMute = '#868e96';
  const border = dark ? '#373a40' : '#e9ecef';

  const handleClose = () => {
    setUrl('');
    setPreview(null);
    setError(null);
    onClose();
  };

  const handlePreview = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const result = await fetchPreview(url.trim());
      setPreview(result);
    } catch {
      setError('Could not fetch preview. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!preview) return;
    onConfirm(url.trim(), preview);
    handleClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: border }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: textColor, flex: 1 }}>Add Link</Text>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Text style={{ fontSize: 15, color: '#4263eb', fontWeight: '500' }}>Cancel</Text>
          </Pressable>
        </View>

        <View style={{ padding: 16, gap: 12 }}>
          <TextInput
            value={url}
            onChangeText={(v) => { setUrl(v); setPreview(null); setError(null); }}
            placeholder="https://…"
            placeholderTextColor={textMute}
            autoCapitalize="none"
            keyboardType="url"
            autoFocus
            style={{
              fontSize: 15,
              color: textColor,
              backgroundColor: bgSubtle,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: border,
            }}
          />

          <Pressable
            onPress={handlePreview}
            disabled={!url.trim() || loading}
            style={{
              paddingVertical: 11,
              borderRadius: 8,
              backgroundColor: url.trim() ? '#4263eb' : bgSubtle,
              alignItems: 'center',
            }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: '600', color: url.trim() ? '#fff' : textMute }}>
                Preview
              </Text>
            )}
          </Pressable>

          {error && (
            <Text style={{ fontSize: 13, color: '#e03131', textAlign: 'center' }}>{error}</Text>
          )}

          {preview && (
            <View style={{ borderRadius: 10, borderWidth: 1, borderColor: border, overflow: 'hidden', backgroundColor: bgSubtle }}>
              {preview.image ? (
                <Image
                  source={{ uri: preview.image }}
                  style={{ width: '100%', height: 120 }}
                  resizeMode="cover"
                />
              ) : null}
              <View style={{ padding: 12, gap: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: textColor }} numberOfLines={2}>
                  {preview.title ?? url}
                </Text>
                {preview.description ? (
                  <Text style={{ fontSize: 12, color: textMute }} numberOfLines={2}>
                    {preview.description}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 11, color: textMute }} numberOfLines={1}>
                  {preview.url}
                </Text>
              </View>
            </View>
          )}

          {preview && (
            <Pressable
              onPress={handleConfirm}
              style={{ paddingVertical: 12, borderRadius: 8, backgroundColor: '#4263eb', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Add to Canvas</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
