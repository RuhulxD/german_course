import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { markdownLessons } from '@/lib/markdownLessons';
import { pickerChrome } from '@/lib/pickerChrome';
import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';

export default function GrammarScreen() {
  const colorScheme = useColorScheme();
  const c = Colors[colorScheme];
  const pc = pickerChrome(colorScheme);
  const [selected, setSelected] = useState(markdownLessons[0]?.path ?? '');

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.background }]} contentContainerStyle={styles.container}>
      <Text style={[styles.h1, { color: c.text }]}>Grammar & Notes</Text>
      <Text style={[styles.label, { color: c.textSecondary }]}>Select file</Text>
      <View style={[styles.pickerWrap, { borderColor: c.border, backgroundColor: c.backgroundElevated }]}>
        <Picker
          selectedValue={selected}
          onValueChange={setSelected}
          style={pc.style}
          itemStyle={pc.itemStyle}
          dropdownIconColor={pc.dropdownIconColor}
        >
          {markdownLessons.map((l) => (
            <Picker.Item key={l.path} label={l.label} value={l.path} color={pc.itemColor} />
          ))}
        </Picker>
      </View>
      <Text style={[styles.hint, { color: c.muted }]}>Choosing a lesson opens the reader screen.</Text>
      <Pressable
        style={[styles.button, { backgroundColor: c.accent }]}
        onPress={() => selected && router.push({ pathname: '/markdown-file', params: { file: selected } })}
      >
        <Text style={[styles.buttonText, { color: c.linkOnAccent }]}>Open selected lesson</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: 20, paddingBottom: 40, maxWidth: 560, alignSelf: 'center', width: '100%' },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { fontWeight: '600', marginBottom: 8 },
  pickerWrap: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  button: { alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  buttonText: { fontWeight: '600', fontSize: 16 },
});
