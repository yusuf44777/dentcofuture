import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenShell } from "../../src/components/screen-shell";
import { requestOtp } from "../../src/lib/mobile-api";
import { useAuthSessionStore } from "../../src/store/auth-session";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthSessionStore((state) => state.setSession);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loginWithEmailPhone = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.replace(/[^0-9+]/g, "").trim();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Geçerli bir e-posta adresi girin.");
      return;
    }
    if (!normalizedPhone || normalizedPhone.replace(/\D+/g, "").length < 10) {
      setError("Geçerli bir telefon numarası girin.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const session = await requestOtp(normalizedEmail, normalizedPhone);
      await setSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
        email: session.user?.email
      });
      setMessage("Giriş başarılı, yönlendiriliyorsunuz...");
      router.replace("/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell
      title="Güvenli Giriş"
      subtitle="DentCo Outlier için e-posta ve telefon eşleşmesi ile giriş yapın."
    >
      <View style={styles.card}>
        <Text style={styles.label}>E-posta</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="ornek@eposta.com"
          placeholderTextColor="#8D9895"
          style={styles.input}
          value={email}
        />

        <Text style={[styles.label, styles.phoneLabel]}>Telefon</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          keyboardType="phone-pad"
          onChangeText={setPhone}
          placeholder="+90 5xx xxx xx xx"
          placeholderTextColor="#8D9895"
          style={styles.input}
          value={phone}
        />

        {message ? <Text style={styles.messageText}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          disabled={busy}
          style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null, busy ? styles.disabled : null]}
          onPress={() => {
            void loginWithEmailPhone();
          }}
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Giriş Yap</Text>}
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg
  },
  label: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.xs
  },
  phoneLabel: {
    marginTop: spacing.md
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 15,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12
  },
  messageText: {
    color: colors.positive,
    fontFamily: typography.body,
    fontSize: 13,
    marginBottom: spacing.sm
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    marginBottom: spacing.sm
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "800"
  },
  disabled: {
    opacity: 0.7
  },
  pressed: {
    opacity: 0.82
  }
});
