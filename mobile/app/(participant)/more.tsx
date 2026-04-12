import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, LogOut, MapPin, Save, UserRound } from "lucide-react-native";
import { ScreenShell } from "../../src/components/screen-shell";
import { fetchNetworkingFeed, submitOnboarding } from "../../src/lib/mobile-api";
import type { AttendeeClassLevel, AttendeeRole } from "../../src/lib/mobile-contracts";
import {
  calculateOutlierScore,
  getOutlierTitle,
  QUIZ_QUESTIONS
} from "../../src/lib/outlier-quiz";
import { NETWORKING_INTEREST_OPTIONS } from "../../src/lib/contracts";
import { useMobileMe } from "../../src/hooks/use-mobile-me";
import { useAuthSessionStore } from "../../src/store/auth-session";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

type ProfileRole = "Student" | "Academic";

type QuizAnswerMap = Record<number, number>;

const PROFILE_ROLES: ProfileRole[] = ["Student", "Academic"];

const ROLE_LABELS: Record<ProfileRole, string> = {
  Student: "Öğrenci",
  Academic: "Akademisyen"
};

const CLASS_LEVEL_OPTIONS: AttendeeClassLevel[] = ["Hazırlık", "1", "2", "3", "4", "5", "Mezun"];
const QUIZ_SCALE_VALUES = [1, 2, 3, 4, 5];

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

  const [quizAnswers, setQuizAnswers] = useState<QuizAnswerMap>({});
  const [quizUnlocked, setQuizUnlocked] = useState(hasAttendee);

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
    setQuizUnlocked(true);
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
    if (role !== "Student") {
      setClassLevel(null);
      setIsClassLevelOpen(false);
    }
  }, [role]);

  const answeredCount = useMemo(
    () => QUIZ_QUESTIONS.filter((question) => typeof quizAnswers[question.id] === "number").length,
    [quizAnswers]
  );

  const isQuizComplete = answeredCount === QUIZ_QUESTIONS.length;

  const quizScore = useMemo(
    () => calculateOutlierScore(QUIZ_QUESTIONS.map((question) => quizAnswers[question.id] ?? 0)),
    [quizAnswers]
  );

  const profileOutlierScore = attendee?.outlier_score ?? quizScore;
  const showQuizStep = !hasAttendee && !quizUnlocked;
  const requiresRoleReset = attendee ? !isProfileRole(attendee.role) : false;

  const canSaveProfile =
    name.trim().length >= 2 &&
    role !== null &&
    university.trim().length >= 2 &&
    (role === "Academic" || classLevel !== null) &&
    (!showQuizStep || isQuizComplete);

  const onboardingMutation = useMutation({
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

      if (!hasAttendee && !isQuizComplete) {
        throw new Error("Önce Outlier testini tamamlamalısın.");
      }

      return submitOnboarding({
        name,
        role,
        class_level: role === "Student" ? classLevel : null,
        dentistry_interest_area:
          !hasAttendee || hasEditedDentistryInterestArea ? dentistryInterestArea : undefined,
        university: university.trim(),
        instagram: instagram.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        outlier_score: profileOutlierScore
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-me"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-leaderboard"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-networking-feed"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-networking-gallery-feed"] })
      ]);
    }
  });

  const answerQuizQuestion = (questionId: number, value: number) => {
    setQuizAnswers((current) => ({
      ...current,
      [questionId]: value
    }));
  };

  return (
    <ScreenShell
      title="Profilim"
      subtitle="Önce Outlier testini tamamla, sonra profilini kaydet ve tüm participant modüllerinin kilidini aç."
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

      {showQuizStep ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aşama 1 • Outlier Testi</Text>
          <Text style={styles.helpText}>
            Profil oluşturmadan önce testi tamamlamalısın. Test sonucu profil puanına otomatik yazılır.
          </Text>

          {QUIZ_QUESTIONS.map((question) => {
            const selectedValue = quizAnswers[question.id];

            return (
              <View key={question.id} style={styles.quizQuestionCard}>
                <Text style={styles.quizQuestionTitle}>
                  {question.id}. {question.text}
                </Text>

                {question.type === "scale" ? (
                  <>
                    <View style={styles.scaleRow}>
                      {QUIZ_SCALE_VALUES.map((value) => (
                        <Pressable
                          key={`${question.id}-${value}`}
                          style={({ pressed }) => [
                            styles.scaleValueButton,
                            selectedValue === value ? styles.scaleValueButtonSelected : null,
                            pressed ? styles.pressed : null
                          ]}
                          onPress={() => answerQuizQuestion(question.id, value)}
                        >
                          <Text
                            style={[
                              styles.scaleValueText,
                              selectedValue === value ? styles.scaleValueTextSelected : null
                            ]}
                          >
                            {value}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <View style={styles.scaleLegend}>
                      <Text style={styles.scaleLegendText}>{question.scaleMin}</Text>
                      <Text style={styles.scaleLegendText}>{question.scaleMax}</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.choiceWrap}>
                    {(question.options ?? []).map((option) => (
                      <Pressable
                        key={`${question.id}-${option.value}-${option.label}`}
                        style={({ pressed }) => [
                          styles.choiceButton,
                          selectedValue === option.value ? styles.choiceButtonSelected : null,
                          pressed ? styles.pressed : null
                        ]}
                        onPress={() => answerQuizQuestion(question.id, option.value)}
                      >
                        <Text
                          style={[
                            styles.choiceText,
                            selectedValue === option.value ? styles.choiceTextSelected : null
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          <Text style={styles.progressText}>Yanıtlanan: {answeredCount}/{QUIZ_QUESTIONS.length}</Text>

          <Pressable
            disabled={!isQuizComplete}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.pressed : null,
              !isQuizComplete ? styles.disabled : null
            ]}
            onPress={() => {
              setQuizUnlocked(true);
            }}
          >
            <Text style={styles.primaryButtonText}>Teste Devam Et</Text>
          </Pressable>
        </View>
      ) : null}

      {!hasAttendee && quizUnlocked ? (
        <View style={styles.outlierResultCard}>
          <View>
            <Text style={styles.outlierResultTitle}>Outlier Sonucun</Text>
            <Text style={styles.outlierResultSubtitle}>{getOutlierTitle(profileOutlierScore)}</Text>
          </View>
          <Text style={styles.outlierResultScore}>{profileOutlierScore}</Text>
          <Pressable
            style={({ pressed }) => [styles.retakeButton, pressed ? styles.pressed : null]}
            onPress={() => {
              setQuizUnlocked(false);
            }}
          >
            <Text style={styles.retakeButtonText}>Testi Düzenle</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{hasAttendee ? "Profil Bilgileri" : "Aşama 2 • Profil Bilgileri"}</Text>

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
          placeholder="Instagram kullanıcı adı"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          value={linkedin}
          onChangeText={(value) => setLinkedin(value)}
          placeholder="LinkedIn profil linki"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
        />

        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>Outlier Puanı</Text>
          <Text style={styles.scoreValue}>{profileOutlierScore}</Text>
        </View>

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
  quizQuestionCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.sm
  },
  quizQuestionTitle: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: spacing.sm
  },
  scaleRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  scaleValueButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  scaleValueButtonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  scaleValueText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "800"
  },
  scaleValueTextSelected: {
    color: "#FFFFFF"
  },
  scaleLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs
  },
  scaleLegendText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 11
  },
  choiceWrap: {
    gap: spacing.xs
  },
  choiceButton: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  choiceButtonSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderLeftColor: colors.accent,
    borderLeftWidth: 3
  },
  choiceText: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 17
  },
  choiceTextSelected: {
    color: colors.accent,
    fontWeight: "700"
  },
  progressText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginBottom: spacing.sm
  },
  outlierResultCard: {
    alignItems: "center",
    backgroundColor: "rgba(201,169,110,0.08)",
    borderColor: "rgba(201,169,110,0.3)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  outlierResultTitle: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: "center"
  },
  outlierResultSubtitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center"
  },
  outlierResultScore: {
    color: colors.copper,
    fontFamily: typography.display,
    fontSize: 44,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  retakeButton: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(201,169,110,0.3)",
    borderRadius: radii.pill,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7
  },
  retakeButtonText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
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
  scoreRow: {
    alignItems: "center",
    backgroundColor: "rgba(139,92,246,0.08)",
    borderColor: "rgba(139,92,246,0.2)",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  scoreLabel: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700"
  },
  scoreValue: {
    color: colors.accent,
    fontFamily: typography.display,
    fontSize: 20,
    fontWeight: "800"
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
