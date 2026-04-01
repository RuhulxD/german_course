import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { contentUrlEncoded } from '@/lib/contentBase';

export default function MarkdownFileScreen() {
  const { file } = useLocalSearchParams<{ file: string }>();
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const [body, setBody] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const url = useMemo(() => (file ? contentUrlEncoded(file) : ''), [file]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!file || !url) {
        setBody(null);
        setErr('No file selected');
        return;
      }
      setErr(null);
      setBody(null);
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`File not found: ${file}`);
        const t = await r.text();
        if (!cancelled) setBody(t);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, url]);

  const mdStyle = useMemo(
    () => ({
      body: {
        color: colorScheme === 'dark' ? '#fff' : '#111',
        fontSize: 16,
        lineHeight: 24,
      },
      heading1: { marginTop: 16, marginBottom: 8 },
      heading2: { marginTop: 14, marginBottom: 6, color: colorScheme === 'dark' ? '#7cb7ff' : '#2f95dc' },
      fence: {
        backgroundColor: colorScheme === 'dark' ? '#222' : '#f5f5f5',
        borderRadius: 6,
      },
      table: { borderWidth: 1, borderColor: colorScheme === 'dark' ? '#444' : '#ddd' },
    }),
    [colorScheme],
  );

  return (
    <>
      <Stack.Screen options={{ title: file ?? 'Lesson' }} />
      <View style={styles.wrap}>
        {!file ? <Text style={styles.muted}>Missing file param.</Text> : null}
        {!body && !err ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : err ? (
          <Text style={styles.err}>{err}</Text>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 32, maxWidth: 720, width, alignSelf: 'center' }}>
            <Markdown style={mdStyle}>{body ?? ''}</Markdown>
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  muted: { opacity: 0.75 },
  err: { color: '#c00', marginTop: 12 },
});
