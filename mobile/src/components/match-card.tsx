import type { ReactNode } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowUpRight, Instagram, Linkedin, MapPin, Sparkles } from "lucide-react-native";
import type { NetworkingPublicProfile } from "../lib/contracts";
import { getProfileContact } from "../lib/networking";
import { colors, radii, shadows, spacing, typography } from "../theme/tokens";

type MatchCardProps = {
  profile: NetworkingPublicProfile;
  accent?: "teal" | "sand";
};

export function MatchCard({ profile, accent = "teal" }: MatchCardProps) {
  const contact = getProfileContact(profile);
  const cardStyle = accent === "teal" ? styles.cardTeal : styles.cardSand;

  return (
    <View style={[styles.card, cardStyle]}>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <Text style={styles.name}>{profile.full_name}</Text>
          {profile.headline ? <Text style={styles.headline}>{profile.headline}</Text> : null}
        </View>
        {typeof profile.match_score === "number" ? (
          <View style={styles.scoreBadge}>
            <Sparkles color={colors.accent} size={14} />
            <Text style={styles.scoreText}>{profile.match_score}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{profile.interest_area}</Text>
        <Text style={styles.metaDot}>•</Text>
        <Text style={styles.metaText}>{profile.goal}</Text>
      </View>

      {profile.city ? (
        <View style={styles.locationRow}>
          <MapPin color={colors.copper} size={14} />
          <Text style={styles.locationText}>{profile.city}</Text>
        </View>
      ) : null}

      {profile.match_reasons && profile.match_reasons.length > 0 ? (
        <View style={styles.reasonWrap}>
          {profile.match_reasons.map((reason) => (
            <View key={reason} style={styles.reasonPill}>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.topicWrap}>
        {profile.collaboration_goals.slice(0, 2).map((item) => (
          <View key={item} style={styles.softPill}>
            <Text style={styles.softPillText}>{item}</Text>
          </View>
        ))}
        {profile.topics.slice(0, 2).map((item) => (
          <View key={item} style={styles.softPill}>
            <Text style={styles.softPillText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.contactRow}>
        {contact.instagram.url && contact.instagram.label ? (
          <ContactButton
            icon={<Instagram color="#C13584" size={15} />}
            label={contact.instagram.label}
            url={contact.instagram.url}
          />
        ) : null}

        {contact.linkedin.url && contact.linkedin.label ? (
          <ContactButton
            icon={<Linkedin color="#0A66C2" size={15} />}
            label={contact.linkedin.label}
            url={contact.linkedin.url}
          />
        ) : null}
      </View>
    </View>
  );
}

type ContactButtonProps = {
  icon: ReactNode;
  label: string;
  url: string;
};

function ContactButton({ icon, label, url }: ContactButtonProps) {
  return (
    <Pressable
      onPress={() => {
        void Linking.openURL(url);
      }}
      style={({ pressed }) => [styles.contactButton, pressed ? styles.contactButtonPressed : null]}
    >
      {icon}
      <Text numberOfLines={1} style={styles.contactButtonText}>
        {label}
      </Text>
      <ArrowUpRight color={colors.inkMuted} size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows
  },
  cardTeal: {
    backgroundColor: colors.surface
  },
  cardSand: {
    backgroundColor: colors.surface
  },
  topRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  identity: {
    flex: 1,
    paddingRight: spacing.md
  },
  name: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700"
  },
  headline: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4
  },
  scoreBadge: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  scoreText: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.sm
  },
  metaText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700"
  },
  metaDot: {
    color: colors.inkMuted,
    marginHorizontal: 6
  },
  locationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.sm
  },
  locationText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700"
  },
  reasonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.md
  },
  reasonPill: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    marginBottom: spacing.xs,
    marginRight: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  reasonText: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  topicWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.md
  },
  softPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    marginBottom: spacing.xs,
    marginRight: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  softPillText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  contactRow: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  contactButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  contactButtonPressed: {
    opacity: 0.8
  },
  contactButtonText: {
    color: colors.ink,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
    marginRight: 8
  }
});
