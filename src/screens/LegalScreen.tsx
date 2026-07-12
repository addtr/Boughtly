import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/types';
import { LEGAL_EFFECTIVE_DATE, getLegalDoc } from '../content/legal';
import { Palette, fonts, spacing } from '../theme/theme';
import { useThemedStyles } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Legal'>;

/** Renders the Privacy Policy or Terms & Disclaimer from src/content/legal.ts. */
export function LegalScreen({ route }: Props) {
  const styles = useThemedStyles(makeStyles);
  const doc = getLegalDoc(route.params.doc);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{doc.title}</Text>
      <Text style={styles.updated}>Last updated {LEGAL_EFFECTIVE_DATE}</Text>
      <Text style={styles.intro}>{doc.intro}</Text>

      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          {section.body.map((paragraph, i) =>
            paragraph.startsWith('• ') ? (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{paragraph.slice(2)}</Text>
              </View>
            ) : (
              <Text key={i} style={styles.paragraph}>
                {paragraph}
              </Text>
            )
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    color: colors.deepBlue,
  },
  updated: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  intro: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginTop: spacing.md,
  },
  section: {
    marginTop: spacing.lg,
  },
  heading: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.deepBlue,
    marginBottom: spacing.xs,
  },
  paragraph: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
    marginTop: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    paddingLeft: spacing.xs,
  },
  bulletDot: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    marginRight: spacing.sm,
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
});
