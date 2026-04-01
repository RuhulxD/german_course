import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type NavCardProps = {
  href: '/flashcards' | '/vocabulary' | '/grammar';
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  description: string;
};

function NavCard({ href, icon, title, description }: NavCardProps) {
  const colorScheme = useColorScheme();
  const border = colorScheme === 'dark' ? '#333' : '#e0e0e0';

  return (
    <Link href={href} asChild>
      <Pressable style={({ pressed }) => [styles.card, { borderColor: border, opacity: pressed ? 0.85 : 1 }]}>
        <FontAwesome name={icon} size={40} color={Colors[colorScheme].tint} style={styles.cardIcon} />
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{description}</Text>
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>German Course</Text>
        <Text style={styles.subtitle}>Vocabulary, grammar, and flashcards</Text>
      </View>

      <NavCard
        href="/flashcards"
        icon="book"
        title="Flashcards"
        description="Study words with modes, filters, and spaced-style review."
      />
      <NavCard
        href="/vocabulary"
        icon="list"
        title="Vocabulary"
        description="Browse CSV lessons with search and pronunciation."
      />
      <NavCard
        href="/grammar"
        icon="file-text-o"
        title="Grammar"
        description="Read grammar and notes as markdown lessons."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    opacity: 0.8,
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  cardIcon: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.85,
    lineHeight: 20,
  },
});
