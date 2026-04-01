import * as Speech from 'expo-speech';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { allPages, books, parseCSV } from '@/lib/config';
import { contentUrl } from '@/lib/contentBase';
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
  const border = colorScheme === 'dark' ? '#444' : '#ccc';
  const inputBg = colorScheme === 'dark' ? '#1c1c1c' : '#fff';

  const [pagePath, setPagePath] = useState('');
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
        ? styles.wordCell
        : headerIdx === 1
          ? styles.pronCell
          : headerIdx === 2 || headerIdx === 3
            ? styles.meaningCell
            : headerName === 'German sentence'
              ? styles.sentenceCell
              : undefined;

    const parts = highlightParts(val, q);

    if (headerIdx === 0 && clean) {
      return (
        <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Pressable onPress={() => speak(word)} accessibilityLabel="Play pronunciation">
            <Text style={styles.audioBtn}>🔊</Text>
          </Pressable>
          <Text style={baseStyle}>
            {parts.map((part, i) => (
              <Text key={i} style={part.match ? styles.mark : undefined}>
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
          <Text key={i} style={part.match ? styles.mark : undefined}>
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
      <RNView style={[styles.row, { borderColor: border }]}>
        {headers.map((h, i) => (
          <RNView key={h} style={styles.cell}>
            {renderCell(item[h] || '', i, h, item, searchQuery)}
          </RNView>
        ))}
        <RNView style={styles.cell}>
          {clean ? (
            <RNView style={styles.actions}>
              <Pressable onPress={() => openUrl(`https://translate.google.com/?sl=de&tl=bn&text=${enc}`)}>
                <Text style={styles.linkBtn}>Translate</Text>
              </Pressable>
              <Pressable onPress={() => openUrl(`https://www.dict.cc/?s=${enc}`)}>
                <Text style={[styles.linkBtn, styles.linkSecondary]}>Dict.cc</Text>
              </Pressable>
              <Pressable onPress={() => openUrl(`https://en.wiktionary.org/wiki/${enc}#German`)}>
                <Text style={[styles.linkBtn, styles.linkContrast]}>Wiktionary</Text>
              </Pressable>
            </RNView>
          ) : null}
        </RNView>
      </RNView>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>German Vocabulary</Text>

      <RNView style={[styles.searchRow, { borderColor: border }]}>
        <TextInput
          placeholder="Search all vocabulary…"
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: colorScheme === 'dark' ? '#fff' : '#000' }]}
          onSubmitEditing={searchVocabulary}
          returnKeyType="search"
        />
        <Pressable onPress={searchVocabulary} style={styles.searchBtn}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </RNView>
      {searchInfo ? <Text style={styles.info}>{searchInfo}</Text> : null}

      <Text style={styles.label}>Page</Text>
      <RNView style={[styles.pickerWrap, { borderColor: border }]}>
        <Picker selectedValue={pagePath} onValueChange={(v) => { setPagePath(v); loadCSV(v); }}>
          {pickerItems.map((it) => (
            <Picker.Item key={it.value || 'empty'} label={it.label} value={it.value} />
          ))}
        </Picker>
      </RNView>

      {loading ? <Text style={styles.muted}>Loading…</Text> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}

      {!loading && !rows.length && !error ? (
        <Text style={styles.muted}>Select a page or run a search.</Text>
      ) : null}

      {headers.length > 0 && rows.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <RNView>
              <RNView style={[styles.row, styles.headerRow, { borderColor: border }]}>
                {headers.map((h) => (
                  <RNView key={h} style={styles.cell}>
                    <Text style={styles.th}>{h}</Text>
                  </RNView>
                ))}
                <RNView style={styles.cell}>
                  <Text style={styles.th}>Actions</Text>
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
                <Text style={pageIndex <= 0 ? styles.pageBtnDisabled : undefined}>Prev</Text>
              </Pressable>
              <Text style={styles.pageLabel}>
                {books.find((b) => b.folder === pagePath.split('/')[0])?.name ?? pagePath.split('/')[0]} — Page{' '}
                {pagePath.split('/')[1]} ({pageIndex + 1} of {allPages.length})
              </Text>
              <Pressable onPress={goNext} disabled={pageIndex >= allPages.length - 1} style={styles.pageBtn}>
                <Text style={pageIndex >= allPages.length - 1 ? styles.pageBtnDisabled : undefined}>Next</Text>
              </Pressable>
            </RNView>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 200, borderWidth: 1, borderRadius: 8, padding: 10 },
  searchBtn: { backgroundColor: '#2f95dc', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  searchBtnText: { color: '#fff', fontWeight: '600' },
  info: { fontSize: 13, opacity: 0.8, marginBottom: 8 },
  label: { marginTop: 12, marginBottom: 4, fontWeight: '600' },
  pickerWrap: { borderWidth: 1, borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
  muted: { opacity: 0.7, textAlign: 'center', marginVertical: 12 },
  err: { color: '#c00', marginVertical: 8 },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { backgroundColor: 'rgba(127,127,127,0.15)' },
  cell: { width: 140, padding: 8, justifyContent: 'center' },
  th: { fontWeight: '700', fontSize: 12 },
  wordCell: { fontWeight: '700' },
  pronCell: { fontStyle: 'italic', opacity: 0.85 },
  meaningCell: { color: '#2f95dc' },
  sentenceCell: { fontStyle: 'italic', fontSize: 13, opacity: 0.9 },
  mark: { backgroundColor: 'rgba(255,230,120,0.5)' },
  audioBtn: { fontSize: 16 },
  actions: { gap: 6 },
  linkBtn: { fontSize: 11, fontWeight: '700', color: '#fff', backgroundColor: '#2f95dc', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, overflow: 'hidden', textAlign: 'center' },
  linkSecondary: { backgroundColor: '#6c757d' },
  linkContrast: { backgroundColor: '#212529' },
  pageNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' },
  pageBtn: { padding: 8 },
  pageBtnDisabled: { opacity: 0.4 },
  pageLabel: { fontWeight: '600' },
});
