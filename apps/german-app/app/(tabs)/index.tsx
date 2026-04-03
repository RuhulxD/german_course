import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';

import { Text } from '@/components/Themed';
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
  const c = Colors[colorScheme];

  return (
    <Link href={href} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: c.backgroundElevated,
            borderColor: c.border,
            opacity: pressed ? 0.92 : 1,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: colorScheme === 'dark' ? 0.35 : 0.08,
                shadowRadius: 4,
              },
              android: { elevation: 2 },
              default: {},
            }),
          },
        ]}
      >
        <FontAwesome name={icon} size={40} color={c.tint} style={styles.cardIcon} />
        <Text style={[styles.cardTitle, { color: c.text }]}>{title}</Text>
        <Text style={[styles.cardDesc, { color: c.textSecondary }]}>{description}</Text>
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const c = Colors[colorScheme];

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.background }]} contentContainerStyle={styles.container}>
      <RNView style={styles.heroWrap}>
        <LinearGradient colors={[...c.heroGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={[styles.title, { color: c.heroOnGradient }]}>German Course</Text>
          <Text style={[styles.subtitle, { color: c.heroMutedOnGradient }]}>Vocabulary, grammar, and flashcards</Text>
        </LinearGradient>
      </RNView>

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
  scroll: { flex: 1 },
  container: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  heroWrap: { marginHorizontal: -20, marginTop: -20, marginBottom: 20 },
  hero: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    marginBottom: 14,
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
    lineHeight: 21,
  },
});
