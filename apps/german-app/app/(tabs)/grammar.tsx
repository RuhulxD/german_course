import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { markdownLessons } from '@/lib/markdownLessons';
import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';

export default function GrammarScreen() {
  const [selected, setSelected] = useState(markdownLessons[0]?.path ?? '');

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Grammar & Notes</Text>
      <Text style={styles.label}>Select file</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={selected} onValueChange={setSelected}>
          {markdownLessons.map((l) => (
            <Picker.Item key={l.path} label={l.label} value={l.path} />
          ))}
        </Picker>
      </View>
      <Text style={styles.hint}>Choosing a lesson opens the reader screen.</Text>
      <Pressable
        style={styles.button}
        onPress={() => selected && router.push({ pathname: '/markdown-file', params: { file: selected } })}
      >
        <Text style={styles.buttonText}>Open selected lesson</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { fontWeight: '600', marginBottom: 6 },
  pickerWrap: { borderWidth: 1, borderRadius: 8, borderColor: '#ccc', overflow: 'hidden', marginBottom: 12 },
  hint: { opacity: 0.75, marginBottom: 12 },
  button: { alignSelf: 'flex-start', backgroundColor: '#2f95dc', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
