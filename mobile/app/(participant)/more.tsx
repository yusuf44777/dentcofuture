import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  LogOut,
  MapPin,
  Save,
  UserRound
} from "lucide-react-native";
import { ScreenShell } from "../../src/components/screen-shell";
import { fetchNetworkingFeed, submitOnboarding } from "../../src/lib/mobile-api";
import type { AttendeeClassLevel, AttendeeRole } from "../../src/lib/mobile-contracts";
import { NETWORKING_INTEREST_OPTIONS } from "../../src/lib/contracts";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { useAuthSessionStore } from "../../src/store/auth-session";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

type ProfileRole = "Student" | "Academic";

const PROFILE_ROLES: ProfileRole[] = ["Student", "Academic"];

const ROLE_LABELS: Record<ProfileRole, string> = {
  Student: "Öğrenci",
  Academic: "Akademisyen"
};

const CLASS_LEVEL_OPTIONS: AttendeeClassLevel[] = ["Hazırlık", "1", "2", "3", "4", "5", "Mezun"];

function isProfileRole(value: AttendeeRole | null | undefined): value is ProfileRole {
  return value === "Student" || value === "Academic";
}

function normalizeClassLevel(value: string | null | undefined): AttendeeClassLevel | null {
  if (typeof value !== "string") {
    return null;
  }

  return CLASS_LEVEL_OPTIONS.includes(value as AttendeeClassLevel)
    ? (value as AttendeeClassLevel)
    : null;
}

function normalizeDentistryInterestArea(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return NETWORKING_INTEREST_OPTIONS.includes(normalized as (typeof NETWORKING_INTEREST_OPTIONS)[number])
    ? normalized
    : null;
}

export default function ParticipantMoreScreen() {
  const queryClient = useQueryClient();
  const clear = useAuthSessionStore((state) => state.clear);
  const { me } = useMobileMe();

  const attendee = me?.attendee ?? null;
  const hasAttendee = Boolean(attendee?.id);

  const [name, setName] = useState("");
  const [role, setRole] = useState<ProfileRole | null>(null);
  const [classLevel, setClassLevel] = useState<AttendeeClassLevel | null>(null);
  const [isClassLevelOpen, setIsClassLevelOpen] = useState(false);
  const [dentistryInterestArea, setDentistryInterestArea] = useState<string>(
    NETWORKING_INTEREST_OPTIONS[0]
  );
  const [isDentistryInterestAreaOpen, setIsDentistryInterestAreaOpen] = useState(false);
  const [hasEditedDentistryInterestArea, setHasEditedDentistryInterestArea] = useState(false);
  const [university, setUniversity] = useState("");
  const [instagram, setInstagram] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [saveNotice, setSaveNotice] = useState("");

  const feedQuery = useQuery({
    queryKey: ["mobile-networking-feed"],
    queryFn: fetchNetworkingFeed,
    enabled: Boolean(attendee?.id)
  });

  useEffect(() => {
    if (!attendee) {
      return;
    }

    setName(attendee.name ?? "");
    setRole(isProfileRole(attendee.role) ? attendee.role : null);
    setClassLevel(normalizeClassLevel(attendee.class_level));
    setUniversity(attendee.university ?? "");
    setInstagram(attendee.instagram ?? "");
    setLinkedin(attendee.linkedin ?? "");
  }, [attendee]);

  useEffect(() => {
    setDentistryInterestArea(NETWORKING_INTEREST_OPTIONS[0]);
    setIsDentistryInterestAreaOpen(false);
    setHasEditedDentistryInterestArea(false);
  }, [attendee?.id]);

  useEffect(() => {
    if (hasEditedDentistryInterestArea) {
      return;
    }

    const suggestedArea = normalizeDentistryInterestArea(feedQuery.data?.current?.interestArea);
    if (!suggestedArea) {
      return;
    }

    setDentistryInterestArea(suggestedArea);
  }, [feedQuery.data?.current?.interestArea, hasEditedDentistryInterestArea]);

  useEffect(() => {
    if (role === "Academic") {
      setClassLevel(null);
      setIsClassLevelOpen(false);
    }
  }, [role]);

  useEffect(() => {
    if (!saveNotice) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setSaveNotice("");
    }, 4200);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [saveNotice]);

  const requiresRoleReset = attendee ? !isProfileRole(attendee.role) : false;

  const canSaveProfile =
    name.trim().length >= 2 &&
    role !== null &&
    university.trim().length >= 2 &&
    (role === "Academic" || classLevel !== null);

  const onboardingMutation = useMutation({
    onMutate: () => {
      setSaveNotice("");
    },
    mutationFn: async () => {
      if (!role) {
        throw new Error("Rol seçimi zorunlu.");
      }

      if (role === "Student" && !classLevel) {
        throw new Error("Öğrenci için sınıf seçimi zorunlu.");
      }

      if (university.trim().length < 2) {
        throw new Error("Üniversite bilgisi zorunlu.");
      }

      return submitOnboarding({
        name,
        role,
        class_level: role === "Student" ? classLevel : null,
        dentistry_interest_area:
          !hasAttendee || hasEditedDentistryInterestArea ? dentistryInterestArea : undefined,
        university: university.trim(),
        instagram: instagram.trim() || undefined,
        linkedin: linkedin.trim() || undefined
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-me"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-leaderboard"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-networking-feed"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-networking-gallery-feed"] })
      ]);
      setSaveNotice("Profilin kaydedildi. Değişiklikler Profilim ve Outliers alanlarına yansıtıldı.");
    }
  });

  return (
    <ScreenShell
      title="Profilim"
      subtitle="Profilini kaydet ve tüm participant modüllerinin kilidini aç."
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
        <Text style={styles.cardTitle}>Profil Bilgileri</Text>

        {requiresRoleReset ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              Eski rolün artık desteklenmiyor. Kaydetmeden önce Öğrenci veya Akademisyen seçmelisin.
            </Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(value) => setName(value)}
          placeholder="Ad Soyad"
          placeholderTextColor={colors.inkMuted}
        />

        <Text style={styles.fieldLabel}>Rol</Text>
        <View style={styles.roleRow}>
          {PROFILE_ROLES.map((candidateRole) => (
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

        {role === "Student" ? (
          <View style={styles.dropdownBlock}>
            <Text style={styles.fieldLabel}>Sınıf</Text>
            <Pressable
              style={({ pressed }) => [
                styles.dropdownButton,
                isClassLevelOpen ? styles.dropdownButtonOpen : null,
                pressed ? styles.pressed : null
              ]}
              onPress={() => {
                setIsDentistryInterestAreaOpen(false);
                setIsClassLevelOpen((current) => !current);
              }}
            >
              <Text style={[styles.dropdownText, classLevel ? styles.dropdownTextSelected : null]}>
                {classLevel ?? "Sınıf seç"}
              </Text>
              <ChevronDown color={colors.inkMuted} size={16} />
            </Pressable>

            {isClassLevelOpen ? (
              <View style={styles.dropdownMenu}>
                {CLASS_LEVEL_OPTIONS.map((value) => (
                  <Pressable
                    key={value}
                    style={({ pressed }) => [
                      styles.dropdownOption,
                      classLevel === value ? styles.dropdownOptionSelected : null,
                      pressed ? styles.pressed : null
                    ]}
                    onPress={() => {
                      setClassLevel(value);
                      setIsClassLevelOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        classLevel === value ? styles.dropdownOptionTextSelected : null
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : role === "Academic" ? (
          <Text style={styles.helpText}>Akademisyen için sınıf seçimi zorunlu değildir.</Text>
        ) : null}

        <View style={styles.dropdownBlock}>
          <Text style={styles.fieldLabel}>Diş Hekimliği Alanı</Text>
          <Pressable
            style={({ pressed }) => [
              styles.dropdownButton,
              isDentistryInterestAreaOpen ? styles.dropdownButtonOpen : null,
              pressed ? styles.pressed : null
            ]}
            onPress={() => {
              setIsClassLevelOpen(false);
              setIsDentistryInterestAreaOpen((current) => !current);
            }}
          >
            <Text style={[styles.dropdownText, styles.dropdownTextSelected]}>{dentistryInterestArea}</Text>
            <ChevronDown color={colors.inkMuted} size={16} />
          </Pressable>

          {isDentistryInterestAreaOpen ? (
            <View style={styles.dropdownMenu}>
              {NETWORKING_INTEREST_OPTIONS.map((value) => (
                <Pressable
                  key={value}
                  style={({ pressed }) => [
                    styles.dropdownOption,
                    dentistryInterestArea === value ? styles.dropdownOptionSelected : null,
                    pressed ? styles.pressed : null
                  ]}
                  onPress={() => {
                    setDentistryInterestArea(value);
                    setHasEditedDentistryInterestArea(true);
                    setIsDentistryInterestAreaOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      dentistryInterestArea === value ? styles.dropdownOptionTextSelected : null
                    ]}
                  >
                    {value}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <TextInput
          style={styles.input}
          value={university}
          onChangeText={(value) => setUniversity(value.slice(0, 120))}
          placeholder="Üniversite"
          placeholderTextColor={colors.inkMuted}
        />

        <TextInput
          style={styles.input}
          value={instagram}
          onChangeText={(value) => setInstagram(value)}
          placeholder="@kullaniciadi veya instagram.com/..."
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          value={linkedin}
          onChangeText={(value) => setLinkedin(value)}
          placeholder="linkedin.com/in/... veya kullanıcı adı"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
        />

        {onboardingMutation.error ? (
          <Text style={styles.errorText}>
            {onboardingMutation.error instanceof Error
              ? onboardingMutation.error.message
              : "Profil güncellenemedi."}
          </Text>
        ) : null}

        {saveNotice ? (
          <View style={styles.successBanner}>
            <CheckCircle2 color={colors.positive} size={18} />
            <View style={styles.successTextBlock}>
              <Text style={styles.successTitle}>Profil kaydedildi</Text>
              <Text style={styles.successText}>{saveNotice}</Text>
            </View>
          </View>
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
              <Text style={styles.primaryButtonText}>
                {saveNotice ? "Kaydedildi" : "Profili Kaydet"}
              </Text>
            </>
          )}
        </Pressable>
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
    backgroundColor: "rgba(201,169,110,0.06)",
    borderColor: "rgba(201,169,110,0.18)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: spacing.xs
  },
  eventText: {
    color: colors.inkMuted,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginLeft: spacing.xs
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(139,92,246,0.15)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: spacing.sm
  },
  helpText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.sm
  },
  warningCard: {
    backgroundColor: colors.warningSoft,
    borderColor: "rgba(245,158,11,0.25)",
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.sm
  },
  warningText: {
    color: colors.warning,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 17
  },
  fieldLabel: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: spacing.xs
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
    paddingVertical: 12
  },
  roleRow: {
    flexDirection: "row",
    marginBottom: spacing.sm
  },
  roleChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  roleChipSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent
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
  dropdownBlock: {
    marginBottom: spacing.sm
  },
  dropdownButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: 12
  },
  dropdownButtonOpen: {
    borderColor: colors.accent
  },
  dropdownText: {
    color: colors.inkMuted,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 14,
    paddingRight: spacing.xs
  },
  dropdownTextSelected: {
    color: colors.ink
  },
  dropdownMenu: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.xs,
    overflow: "hidden"
  },
  dropdownOption: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 11
  },
  dropdownOptionSelected: {
    backgroundColor: colors.accentSoft
  },
  dropdownOptionText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13
  },
  dropdownOptionTextSelected: {
    color: colors.accent,
    fontWeight: "700"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 44
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "800",
    marginLeft: spacing.xs
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 12,
    marginBottom: spacing.sm
  },
  successBanner: {
    alignItems: "flex-start",
    backgroundColor: "rgba(52,211,153,0.1)",
    borderColor: "rgba(52,211,153,0.28)",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  successTextBlock: {
    flex: 1,
    marginLeft: spacing.xs
  },
  successTitle: {
    color: colors.positive,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800"
  },
  successText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  logoutButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(248,113,113,0.1)",
    borderColor: "rgba(248,113,113,0.3)",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10
  },
  logoutText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: spacing.xs
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.8
  }
});
