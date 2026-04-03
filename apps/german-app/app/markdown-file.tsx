import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { contentUrlEncoded } from '@/lib/contentBase';
import Markdown from 'react-native-markdown-display';

export default function MarkdownFileScreen() {
  const { file } = useLocalSearchParams<{ file: string }>();
  const colorScheme = useColorScheme();
  const c = Colors[colorScheme];
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
        color: c.text,
        fontSize: 16,
        lineHeight: 26,
      },
      heading1: {
        marginTop: 20,
        marginBottom: 10,
        color: c.text,
        fontWeight: '700' as const,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      },
      heading2: {
        marginTop: 18,
        marginBottom: 8,
        color: c.accent,
        fontWeight: '600' as const,
      },
      heading3: { marginTop: 14, marginBottom: 6, color: c.text },
      paragraph: { marginBottom: 10, color: c.text },
      link: { color: c.accent },
      blockquote: {
        borderLeftWidth: 4,
        borderLeftColor: c.accent,
        paddingLeft: 12,
        marginVertical: 8,
        backgroundColor: c.accentMuted,
      },
      fence: {
        backgroundColor: colorScheme === 'dark' ? c.backgroundElevated : c.tableHeaderBg,
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: c.border,
      },
      code_inline: {
        backgroundColor: colorScheme === 'dark' ? c.backgroundElevated : c.tableHeaderBg,
        color: c.text,
        paddingHorizontal: 6,
        borderRadius: 4,
      },
      table: {
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 8,
        overflow: 'hidden' as const,
      },
      tr: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
      th: { backgroundColor: c.tableHeaderBg, color: c.text, fontWeight: '600' as const, padding: 8 },
      td: { padding: 8, color: c.text },
      bullet_list: { marginVertical: 6 },
      ordered_list: { marginVertical: 6 },
      list_item: { color: c.text, marginBottom: 4 },
    }),
    [c, colorScheme],
  );

  return (
    <>
      <Stack.Screen options={{ title: file ?? 'Lesson' }} />
      <View style={[styles.wrap, { backgroundColor: c.background }]}>
        {!file ? <Text style={[styles.muted, { color: c.muted }]}>Missing file param.</Text> : null}
        {!body && !err ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={c.accent} />
        ) : err ? (
          <Text style={[styles.err, { color: c.error }]}>{err}</Text>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 32, maxWidth: 720, width, alignSelf: 'center', paddingHorizontal: 4 }}
          >
            <Markdown style={mdStyle}>{body ?? ''}</Markdown>
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  muted: {},
  err: { marginTop: 12, fontWeight: '500' },
});
