import * as Speech from 'expo-speech';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { allPages, books, parseCSV } from '@/lib/config';
import { contentUrl } from '@/lib/contentBase';
import { pickerChrome } from '@/lib/pickerChrome';
import { Picker } from '@react-native-picker/picker';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightParts(text: string, q: string): { text: string; match: boolean }[] {
  if (!q.trim()) return [{ text, match: false }];
  const re = new RegExp(`(${escapeRegex(q)})`, 'gi');
  const parts = text.split(re);
  return parts.map((p, i) => ({
    text: p,
    match: i % 2 === 1,
  }));
}

export default function VocabularyScreen() {
  const colorScheme = useColorScheme();
  const c = Colors[colorScheme];
  const pc = pickerChrome(colorScheme);

  const [pagePath, setPagePath] = useState('book-1/1');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInfo, setSearchInfo] = useState('');

  const pickerItems = useMemo(() => {
    const items: { label: string; value: string }[] = [{ label: 'Select a page…', value: '' }];
    books.forEach((book) => {
      book.pages.forEach((p) => {
        items.push({
          label: `${book.name} — Page ${p}`,
          value: `${book.folder}/${p}`,
        });
      });
    });
    return items;
  }, []);

  const loadCSV = useCallback(async (path: string) => {
    if (!path) {
      setRows([]);
      setHeaders([]);
      setError(null);
      setSearchInfo('');
      return;
    }
    setLoading(true);
    setError(null);
    setSearchInfo('');
    try {
      const url = contentUrl(`lws/csv/${path}.csv`);
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Not found: lws/csv/${path}.csv`);
      const data = parseCSV(await r.text());
      if (!data.length) {
        setRows([]);
        setHeaders([]);
        setError('Empty CSV');
        return;
      }
      setHeaders(Object.keys(data[0]));
      setRows(data);
    } catch (e) {
      setRows([]);
      setHeaders([]);
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCSV(pagePath);
  }, []);

  const searchVocabulary = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setSearchInfo('');
    setPagePath('');
    const results: Record<string, string>[] = [];
    let total = 0;
    for (const p of allPages) {
      try {
        const url = contentUrl(`lws/csv/${p}.csv`);
        const r = await fetch(url);
        if (r.ok) {
          const data = parseCSV(await r.text());
          total += data.length;
          results.push(
            ...data.filter((row) =>
              Object.values(row).some((v) => v.toLowerCase().includes(q.toLowerCase())),
            ),
          );
        }
      } catch {
        /* skip */
      }
    }
    setLoading(false);
    setSearchInfo(`Found ${results.length} results across ${total} words`);
    if (!results.length) {
      setHeaders([]);
      setRows([]);
      return;
    }
    setHeaders(Object.keys(results[0]));
    setRows(results);
  }, [searchQuery]);

  const pageIndex = pagePath ? allPages.indexOf(pagePath) : -1;

  const goPrev = () => {
    if (pageIndex > 0) {
      const next = allPages[pageIndex - 1];
      setPagePath(next);
      loadCSV(next);
    }
  };

  const goNext = () => {
    if (pageIndex >= 0 && pageIndex < allPages.length - 1) {
      const next = allPages[pageIndex + 1];
      setPagePath(next);
      loadCSV(next);
    }
  };

  const openUrl = (u: string) => WebBrowser.openBrowserAsync(u);

  const speak = (rawWord: string) => {
    const clean = rawWord
      .replace(/^(der|die|das)\s+/i, '')
      .replace(/\s+\(.*?\)/g, '')
      .replace(/\s+-\w*$/g, '')
      .trim();
    if (!clean) return;
    Speech.stop();
    Speech.speak(clean, { language: 'de-DE', rate: 0.9 });
  };

  const renderCell = (val: string, headerIdx: number, headerName: string, row: Record<string, string>, q: string) => {
    const word = row[headers[0]] || '';
    const clean = word
      .replace(/^(der|die|das)\s+/i, '')
      .replace(/\s+\(.*?\)/g, '')
      .replace(/\s+-\w*$/g, '')
      .trim();

    const baseStyle =
      headerIdx === 0
        ? [styles.wordCell, { color: c.text }]
        : headerIdx === 1
          ? [styles.pronCell, { color: c.textSecondary }]
          : headerIdx === 2 || headerIdx === 3
            ? [styles.meaningCell, { color: c.accent }]
            : headerName === 'German sentence'
              ? [styles.sentenceCell, { color: c.textSecondary }]
              : [{ color: c.text }];

    const parts = highlightParts(val, q);

    if (headerIdx === 0 && clean) {
      return (
        <RNView style={styles.cellRow}>
          <Pressable onPress={() => speak(word)} accessibilityLabel="Play pronunciation">
            <Text style={styles.audioBtn}>🔊</Text>
          </Pressable>
          <Text style={baseStyle}>
            {parts.map((part, i) => (
              <Text key={i} style={part.match ? { backgroundColor: c.markHighlight } : undefined}>
                {part.text}
              </Text>
            ))}
          </Text>
        </RNView>
      );
    }

    return (
      <Text style={baseStyle}>
        {parts.map((part, i) => (
          <Text key={i} style={part.match ? { backgroundColor: c.markHighlight } : undefined}>
            {part.text}
          </Text>
        ))}
      </Text>
    );
  };

  const renderRow = ({ item }: { item: Record<string, string> }) => {
    const word = item[headers[0]] || '';
    const clean = word
      .replace(/^(der|die|das)\s+/i, '')
      .replace(/\s+\(.*?\)/g, '')
      .replace(/\s+-\w*$/g, '')
      .trim();
    const enc = encodeURIComponent(clean);

    return (
      <RNView style={[styles.row, { borderColor: c.border }]}>
        {headers.map((h, i) => (
          <RNView key={h} style={styles.cell}>
            {renderCell(item[h] || '', i, h, item, searchQuery)}
          </RNView>
        ))}
        <RNView style={styles.cell}>
          {clean ? (
            <RNView style={styles.actions}>
              <Pressable onPress={() => openUrl(`https://translate.google.com/?sl=de&tl=bn&text=${enc}`)}>
                <Text style={[styles.linkBtn, { backgroundColor: c.accent, color: c.linkOnAccent }]}>Translate</Text>
              </Pressable>
              <Pressable onPress={() => openUrl(`https://www.dict.cc/?s=${enc}`)}>
                <Text style={[styles.linkBtn, { backgroundColor: c.secondaryBtn, color: c.linkOnAccent }]}>
                  Dict.cc
                </Text>
              </Pressable>
              <Pressable onPress={() => openUrl(`https://en.wiktionary.org/wiki/${enc}#German`)}>
                <Text style={[styles.linkBtn, { backgroundColor: colorScheme === 'dark' ? '#3f3f46' : '#334155', color: c.linkOnAccent }]}>
                  Wiktionary
                </Text>
              </Pressable>
            </RNView>
          ) : null}
        </RNView>
      </RNView>
    );
  };

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.background }]} contentContainerStyle={styles.container}>
      <Text style={[styles.h1, { color: c.text }]}>German Vocabulary</Text>

      <RNView style={[styles.searchRow, { borderColor: c.border, backgroundColor: c.backgroundElevated }]}>
        <TextInput
          placeholder="Search all vocabulary…"
          placeholderTextColor={c.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[
            styles.input,
            {
              backgroundColor: c.backgroundElevated,
              borderColor: c.border,
              color: c.text,
            },
          ]}
          onSubmitEditing={searchVocabulary}
          returnKeyType="search"
        />
        <Pressable onPress={searchVocabulary} style={[styles.searchBtn, { backgroundColor: c.accent }]}>
          <Text style={[styles.searchBtnText, { color: c.linkOnAccent }]}>Search</Text>
        </Pressable>
      </RNView>
      {searchInfo ? (
        <Text style={[styles.info, { color: c.textSecondary }]}>{searchInfo}</Text>
      ) : null}

      <Text style={[styles.label, { color: c.text }]}>Page</Text>
      <RNView style={[styles.pickerWrap, { borderColor: c.border, backgroundColor: c.backgroundElevated }]}>
        <Picker
          selectedValue={pagePath}
          onValueChange={(v) => {
            setPagePath(v);
            loadCSV(v);
          }}
          style={pc.style}
          itemStyle={pc.itemStyle}
          dropdownIconColor={pc.dropdownIconColor}
        >
          {pickerItems.map((it) => (
            <Picker.Item key={it.value || 'empty'} label={it.label} value={it.value} color={pc.itemColor} />
          ))}
        </Picker>
      </RNView>

      {loading ? (
        <Text style={[styles.muted, { color: c.muted }]}>Loading…</Text>
      ) : null}
      {error ? (
        <Text style={[styles.err, { color: c.error }]}>{error}</Text>
      ) : null}

      {!loading && !rows.length && !error ? (
        <Text style={[styles.muted, { color: c.muted }]}>Select a page or run a search.</Text>
      ) : null}

      {headers.length > 0 && rows.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <RNView>
              <RNView style={[styles.row, styles.headerRow, { borderColor: c.border, backgroundColor: c.tableHeaderBg }]}>
                {headers.map((h) => (
                  <RNView key={h} style={styles.cell}>
                    <Text style={[styles.th, { color: c.textSecondary }]}>{h}</Text>
                  </RNView>
                ))}
                <RNView style={styles.cell}>
                  <Text style={[styles.th, { color: c.textSecondary }]}>Actions</Text>
                </RNView>
              </RNView>
              <FlatList
                data={rows}
                keyExtractor={(_, i) => String(i)}
                renderItem={renderRow}
                scrollEnabled={false}
              />
            </RNView>
          </ScrollView>

          {pagePath && pageIndex >= 0 ? (
            <RNView style={styles.pageNav}>
              <Pressable onPress={goPrev} disabled={pageIndex <= 0} style={styles.pageBtn}>
                <Text style={[pageIndex <= 0 ? styles.pageBtnDisabled : null, { color: c.accent }]}>Prev</Text>
              </Pressable>
              <Text style={[styles.pageLabel, { color: c.text }]}>
                {books.find((b) => b.folder === pagePath.split('/')[0])?.name ?? pagePath.split('/')[0]} — Page{' '}
                {pagePath.split('/')[1]} ({pageIndex + 1} of {allPages.length})
              </Text>
              <Pressable onPress={goNext} disabled={pageIndex >= allPages.length - 1} style={styles.pageBtn}>
                <Text
                  style={[
                    pageIndex >= allPages.length - 1 ? styles.pageBtnDisabled : null,
                    { color: c.accent },
                  ]}
                >
                  Next
                </Text>
              </Pressable>
            </RNView>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 14 },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
  },
  input: { flex: 1, minWidth: 200, borderWidth: 1, borderRadius: 10, padding: 12 },
  searchBtn: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10 },
  searchBtnText: { fontWeight: '600' },
  info: { fontSize: 13, marginBottom: 8 },
  label: { marginTop: 12, marginBottom: 6, fontWeight: '600', fontSize: 15 },
  pickerWrap: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  muted: { textAlign: 'center', marginVertical: 12 },
  err: { marginVertical: 8, fontWeight: '500' },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: {},
  cell: { width: 140, padding: 8, justifyContent: 'center' },
  cellRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  th: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  wordCell: { fontWeight: '700' },
  pronCell: { fontStyle: 'italic' },
  meaningCell: { fontWeight: '500' },
  sentenceCell: { fontStyle: 'italic', fontSize: 13 },
  audioBtn: { fontSize: 16 },
  actions: { gap: 6 },
  linkBtn: { fontSize: 11, fontWeight: '700', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6, overflow: 'hidden', textAlign: 'center' },
  pageNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 18, flexWrap: 'wrap' },
  pageBtn: { padding: 8 },
  pageBtnDisabled: { opacity: 0.35 },
  pageLabel: { fontWeight: '600', maxWidth: 280, textAlign: 'center' },
});
