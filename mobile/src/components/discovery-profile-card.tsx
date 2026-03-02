import { StyleSheet, Text, View } from "react-native";
import { Clock3, MapPin, Sparkles, Stethoscope } from "lucide-react-native";
import type { NetworkingPublicProfile } from "../lib/contracts";
import { colors, radii, shadows, spacing, typography } from "../theme/tokens";

type DiscoveryProfileCardProps = {
  profile: NetworkingPublicProfile;
};

export function DiscoveryProfileCard({ profile }: DiscoveryProfileCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.scoreRow}>
        <View style={styles.scoreBadge}>
          <Sparkles color={colors.accent} size={15} />
          <Text style={styles.scoreText}>Uyum {profile.match_score ?? 0}</Text>
        </View>
        <View style={styles.scoreBadgeMuted}>
          <Clock3 color={colors.copper} size={14} />
          <Text style={styles.scoreBadgeMutedText}>Aktif</Text>
        </View>
      </View>

      <Text style={styles.name}>{profile.full_name}</Text>
      {profile.headline ? <Text style={styles.headline}>{profile.headline}</Text> : null}

      <View style={styles.metaWrap}>
        <View style={styles.metaPill}>
          <Stethoscope color={colors.accent} size={14} />
          <Text style={styles.metaPillText}>{profile.interest_area}</Text>
        </View>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>{profile.goal}</Text>
        </View>
        {profile.city ? (
          <View style={styles.metaPill}>
            <MapPin color={colors.copper} size={14} />
            <Text style={styles.metaPillText}>{profile.city}</Text>
          </View>
        ) : null}
      </View>

      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      {profile.match_reasons && profile.match_reasons.length > 0 ? (
        <View style={styles.reasonWrap}>
          {profile.match_reasons.map((reason) => (
            <View key={reason} style={styles.reasonPill}>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bag kurma sinyalleri</Text>
        <View style={styles.topicWrap}>
          {profile.collaboration_goals.slice(0, 3).map((item) => (
            <View key={item} style={styles.topicPill}>
              <Text style={styles.topicText}>{item}</Text>
            </View>
          ))}
          {profile.topics.slice(0, 3).map((item) => (
            <View key={item} style={styles.topicPill}>
              <Text style={styles.topicText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Iletisim bilgileri ancak karsilikli ilgi olusunca acilir.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,253,248,0.95)",
    borderColor: "rgba(255,255,255,0.82)",
    borderRadius: 34,
    borderWidth: 1,
    padding: spacing.xl,
    ...shadows
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  scoreBadge: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  scoreText: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  scoreBadgeMuted: {
    alignItems: "center",
    backgroundColor: colors.copperSoft,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  scoreBadgeMutedText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  name: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 34,
    marginTop: spacing.lg
  },
  headline: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm
  },
  metaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.md
  },
  metaPill: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    flexDirection: "row",
    marginBottom: spacing.xs,
    marginRight: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  metaPillText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6
  },
  bio: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 22,
    marginTop: spacing.lg
  },
  reasonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.lg
  },
  reasonPill: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    marginBottom: spacing.xs,
    marginRight: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  reasonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800"
  },
  section: {
    marginTop: spacing.lg
  },
  sectionTitle: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    textTransform: "uppercase"
  },
  topicWrap: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  topicPill: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginBottom: spacing.xs,
    marginRight: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  topicText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  footer: {
    backgroundColor: "#102B2D",
    borderRadius: radii.md,
    marginTop: spacing.xl,
    padding: spacing.md
  },
  footerText: {
    color: "#D6F2EE",
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18
  }
});
