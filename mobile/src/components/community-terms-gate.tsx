import type { PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import { ScreenShell } from "./screen-shell";
import { useContentSafetyStore } from "../store/content-safety";
import { colors, radii, spacing, typography } from "../theme/tokens";

const RULES = [
  "Hakaret, taciz, tehdit, nefret söylemi, cinsel içerik, spam veya izinsiz kişisel bilgi paylaşımına sıfır tolerans uygulanır.",
  "Yorum, soru, açıklama ve profil metinleri otomatik içerik filtresinden geçer.",
  "Uygunsuz içerik veya kullanıcıları Bildir ve Engelle kontrolleriyle moderasyon ekibine iletebilirsin.",
  "Engellediğin kullanıcının içerikleri akışından anında kaldırılır; ekip raporları 24 saat içinde inceler."
];

export function CommunityTermsGate({ children }: PropsWithChildren) {
  const hydrated = useContentSafetyStore((state) => state.hydrated);
  const acceptedAt = useContentSafetyStore((state) => state.acceptedAt);
  const accept = useContentSafetyStore((state) => state.accept);

  if (!hydrated) {
    return (
      <ScreenShell title="Topluluk Kuralları" subtitle="Güvenli deneyim hazırlanıyor.">
        <View style={styles.loaderCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loaderText}>Kurallar yükleniyor...</Text>
        </View>
      </ScreenShell>
    );
  }

  if (acceptedAt) {
    return <>{children}</>;
  }

  return (
    <ScreenShell
      title="Topluluk Kuralları ve EULA"
      subtitle="Outliers içeriklerine geçmeden önce güvenli paylaşım şartlarını kabul etmelisin."
    >
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <ShieldCheck color={colors.accent} size={22} />
        </View>
        <Text style={styles.title}>Güvenli alan taahhüdü</Text>
        <Text style={styles.body}>
          Bu uygulamada kullanıcıların yüklediği içerikler ve yorumlar görünür olabilir. Devam ederek
          aşağıdaki şartlara ve sıfır tolerans politikasına uyacağını kabul edersin.
        </Text>

        {RULES.map((rule) => (
          <View key={rule} style={styles.ruleRow}>
            <View style={styles.ruleDot} />
            <Text style={styles.ruleText}>{rule}</Text>
          </View>
        ))}

        <Text style={styles.legalText}>
          Kuralları ihlal eden içerikler kaldırılır; ağır veya tekrarlı ihlallerde ilgili kullanıcı
          etkinlik deneyiminden çıkarılabilir.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.acceptButton, pressed ? styles.pressed : null]}
          onPress={() => {
            void accept();
          }}
        >
          <Text style={styles.acceptButtonText}>Kabul Ediyorum</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loaderCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl
  },
  loaderText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    marginTop: spacing.sm
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    marginBottom: spacing.md,
    width: 44
  },
  title: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 27
  },
  body: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.sm
  },
  ruleRow: {
    flexDirection: "row",
    marginTop: spacing.sm
  },
  ruleDot: {
    backgroundColor: colors.copper,
    borderRadius: 999,
    height: 6,
    marginRight: spacing.xs,
    marginTop: 7,
    width: 6
  },
  ruleText: {
    color: colors.ink,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19
  },
  legalText: {
    color: colors.copper,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md
  },
  acceptButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    justifyContent: "center",
    marginTop: spacing.lg,
    minHeight: 44
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "800"
  },
  pressed: {
    opacity: 0.82
  }
});
