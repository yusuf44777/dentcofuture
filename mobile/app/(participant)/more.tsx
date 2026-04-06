import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, LogOut, MapPin, Save, Send, Trophy, UserRound } from "lucide-react-native";
import { ScreenShell } from "../../src/components/screen-shell";
import { fetchRafflePublic, submitFeedback, submitOnboarding } from "../../src/lib/mobile-api";
import type { AttendeeRole } from "../../src/lib/mobile-contracts";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { useAuthSessionStore } from "../../src/store/auth-session";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

const ROLES: AttendeeRole[] = ["Student", "Clinician", "Academic", "Entrepreneur", "Industry"];
const ROLE_LABELS: Record<AttendeeRole, string> = {
  Student: "Öğrenci",
  Clinician: "Klinisyen",
  Academic: "Akademisyen",
  Entrepreneur: "Girişimci",
  Industry: "Sektör"
};

export default function ParticipantMoreScreen() {
  const queryClient = useQueryClient();
  const clear = useAuthSessionStore((state) => state.clear);
  const { me } = useMobileMe();

  const [name, setName] = useState("");
  const [role, setRole] = useState<AttendeeRole>("Student");
  const [instagram, setInstagram] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [outlierScore, setOutlierScore] = useState("0");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    if (!me?.attendee) {
      return;
    }

    setName(me.attendee.name ?? "");
    setRole(me.attendee.role ?? "Student");
    setInstagram(me.attendee.instagram ?? "");
    setLinkedin(me.attendee.linkedin ?? "");
    setOutlierScore(String(me.attendee.outlier_score ?? 0));
  }, [me?.attendee]);

  const onboardingMutation = useMutation({
    mutationFn: () =>
      submitOnboarding({
        name,
        role,
        instagram: instagram.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        outlier_score: Number(outlierScore)
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-me"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-leaderboard"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-networking-feed"] })
      ]);
    }
  });

  const feedbackMutation = useMutation({
    mutationFn: (message: string) => submitFeedback(message),
    onSuccess: () => {
      setFeedbackMessage("");
    }
  });

  const rafflePublicQuery = useQuery({
    queryKey: ["mobile-raffle-public"],
    queryFn: fetchRafflePublic,
    refetchInterval: 30_000
  });

  const canSaveProfile = useMemo(() => {
    const score = Number(outlierScore);
    return name.trim().length >= 2 && Number.isFinite(score) && score >= 0 && score <= 100;
  }, [name, outlierScore]);

  return (
    <ScreenShell
      title="Diğer"
      subtitle="Profil, geri bildirim ve etkinlik detaylarını tek yerden yönet."
    >
      <View style={styles.eventCard}>
        <View style={styles.row}>
          <CalendarDays color={colors.accent} size={16} />
          <Text style={styles.eventText}>Etkinlik Tarihi: 16 Mayıs 2026</Text>
        </View>
        <View style={styles.row}>
          <MapPin color={colors.copper} size={16} />
          <Text style={styles.eventText}>Adres: Ümraniye Birikim Okulları, Yamanevler Site Yolu Cd No:22</Text>
        </View>
        <View style={styles.row}>
          <UserRound color={colors.inkMuted} size={16} />
          <Text style={styles.eventText}>Düzenleyen: Communitive Dentistry Üsküdar</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Katılımcı Profili</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(value) => setName(value)}
          placeholder="Ad Soyad"
          placeholderTextColor="#8D9895"
        />
        <View style={styles.roleRow}>
          {ROLES.map((candidateRole) => (
            <Pressable
              key={candidateRole}
              style={({ pressed }) => [
                styles.roleChip,
                role === candidateRole ? styles.roleChipSelected : null,
                pressed ? styles.pressed : null
              ]}
              onPress={() => {
                setRole(candidateRole);
              }}
            >
              <Text style={[styles.roleChipText, role === candidateRole ? styles.roleChipTextSelected : null]}>
                {ROLE_LABELS[candidateRole]}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={instagram}
          onChangeText={(value) => setInstagram(value)}
          placeholder="Instagram kullanıcı adı"
          placeholderTextColor="#8D9895"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={linkedin}
          onChangeText={(value) => setLinkedin(value)}
          placeholder="LinkedIn profil linki"
          placeholderTextColor="#8D9895"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={outlierScore}
          onChangeText={(value) => setOutlierScore(value.replace(/[^0-9]/g, "").slice(0, 3))}
          placeholder="Outlier puanı (0-100)"
          placeholderTextColor="#8D9895"
          keyboardType="number-pad"
        />
        {onboardingMutation.error ? (
          <Text style={styles.errorText}>
            {onboardingMutation.error instanceof Error
              ? onboardingMutation.error.message
              : "Profil güncellenemedi."}
          </Text>
        ) : null}
        <Pressable
          disabled={!canSaveProfile || onboardingMutation.isPending}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed ? styles.pressed : null,
            !canSaveProfile || onboardingMutation.isPending ? styles.disabled : null
          ]}
          onPress={() => {
            onboardingMutation.mutate();
          }}
        >
          {onboardingMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Save color="#FFFFFF" size={14} />
              <Text style={styles.primaryButtonText}>Profili Kaydet</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Geri Bildirim</Text>
        <TextInput
          multiline
          numberOfLines={4}
          style={[styles.input, styles.feedbackInput]}
          value={feedbackMessage}
          onChangeText={(value) => setFeedbackMessage(value.slice(0, 500))}
          placeholder="Etkinlik deneyimini paylaş..."
          placeholderTextColor="#8D9895"
        />
        <Pressable
          disabled={feedbackMutation.isPending || feedbackMessage.trim().length < 2}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed ? styles.pressed : null,
            feedbackMutation.isPending || feedbackMessage.trim().length < 2 ? styles.disabled : null
          ]}
          onPress={() => {
            feedbackMutation.mutate(feedbackMessage.trim());
          }}
        >
          <Send color={colors.accent} size={14} />
          <Text style={styles.secondaryButtonText}>Gönder</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Çekiliş</Text>
          <Trophy color={colors.copper} size={16} />
        </View>
        {rafflePublicQuery.isLoading ? <ActivityIndicator color={colors.accent} size="small" /> : null}
        <Text style={styles.helpText}>Aktif katılımcı: {rafflePublicQuery.data?.participants_active ?? 0}</Text>
        {(rafflePublicQuery.data?.recent_draws ?? []).slice(0, 4).map((draw) => (
          <View key={draw.id} style={styles.drawRow}>
            <Text style={styles.drawTitle}>{draw.prize_title}</Text>
            <Text style={styles.drawWinner}>{draw.winner_name}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [styles.logoutButton, pressed ? styles.pressed : null]}
        onPress={() => {
          void clear();
        }}
      >
        <LogOut color="#FFFFFF" size={14} />
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.sm
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: spacing.xs
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  eventText: {
    color: colors.inkMuted,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginLeft: spacing.xs
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 14,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 11
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: spacing.sm
  },
  roleChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    marginBottom: spacing.xs,
    marginRight: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  roleChipSelected: {
    backgroundColor: colors.accentSoft
  },
  roleChipText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  roleChipTextSelected: {
    color: colors.accent
  },
  feedbackInput: {
    minHeight: 90,
    textAlignVertical: "top"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 42
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: spacing.xs
  },
  secondaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  secondaryButtonText: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: spacing.xs
  },
  helpText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    marginBottom: spacing.xs
  },
  drawRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingVertical: 7
  },
  drawTitle: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  drawWinner: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: 2
  },
  logoutButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    flexDirection: "row",
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  logoutText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginLeft: spacing.xs
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 12,
    marginBottom: spacing.sm
  },
  disabled: {
    opacity: 0.6
  },
  pressed: {
    opacity: 0.82
  }
});
