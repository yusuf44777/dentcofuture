import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import {
  BriefcaseBusiness,
  Globe2,
  Instagram,
  Linkedin,
  MapPinned,
  NotebookTabs,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users
} from "lucide-react-native";
import { Chip } from "./chip";
import {
  createEmptyProfileForm,
  estimateProfileCompleteness,
  networkingFilterOptions,
  networkingSelectionLimits,
  toggleListValue,
  type ProfileFormValues
} from "../lib/networking";
import { colors, radii, shadows, spacing, typography } from "../theme/tokens";

type ProfileEditorProps = {
  initialValues?: ProfileFormValues;
  busy?: boolean;
  errorMessage?: string;
  submitLabel: string;
  helperText?: string;
  onSubmit: (values: ProfileFormValues) => void;
};

export function ProfileEditor({
  initialValues,
  busy = false,
  errorMessage,
  submitLabel,
  helperText,
  onSubmit
}: ProfileEditorProps) {
  const [values, setValues] = useState<ProfileFormValues>(initialValues ?? createEmptyProfileForm());

  useEffect(() => {
    setValues(initialValues ?? createEmptyProfileForm());
  }, [initialValues]);

  const completeness = estimateProfileCompleteness(values);
  const canSubmit =
    !busy &&
    values.fullName.trim().length > 1 &&
    values.interestArea.trim().length > 0 &&
    values.futurePath.trim().length > 0;

  return (
    <View>
      <View style={styles.overviewCard}>
        <View style={styles.overviewHeader}>
          <View style={styles.overviewTextBlock}>
            <Text style={styles.overviewTitle}>Kart Gücü</Text>
            <Text style={styles.overviewSubtitle}>
              Profesyonel kimyanın doğru kişilere gitmesi için detayları doldur ve kartını güçlendir.
            </Text>
          </View>
          <View style={styles.completenessBadge}>
            <Sparkles color={colors.accent} size={16} />
            <Text style={styles.completenessText}>%{completeness}</Text>
          </View>
        </View>

        <View style={styles.visibilityRow}>
          <View style={styles.visibilityTextBlock}>
            <Text style={styles.visibilityTitle}>Keşif görünürlüğü</Text>
            <Text style={styles.visibilitySubtitle}>
              Kapalı kartlar keşif akışında başkalarına gösterilmez.
            </Text>
          </View>
          <Switch
            value={values.isVisible}
            onValueChange={(nextValue) => {
              setValues((currentValues) => ({ ...currentValues, isVisible: nextValue }));
            }}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <FormSection
        icon={<Stethoscope color={colors.accent} size={18} />}
        title="Temel Profil"
        subtitle="Kartın ilk izlenimini belirleyen profesyonel kimlik alanları."
      >
        <Field
          label="Ad Soyad"
          placeholder="Dr. Ayşe Yılmaz"
          value={values.fullName}
          onChangeText={(nextValue) => {
            setValues((currentValues) => ({ ...currentValues, fullName: nextValue }));
          }}
        />

        <Field
          label="Unvan"
          placeholder="Endodontist / Klinik Sahibi"
          value={values.headline}
          onChangeText={(nextValue) => {
            setValues((currentValues) => ({ ...currentValues, headline: nextValue }));
          }}
        />

        <SingleChoiceGroup
          label="Mesleki Rol"
          helper="Sana bakan kişiler kartını önce bu bağlamla görür."
          options={networkingFilterOptions.professions}
          selectedValue={values.profession}
          onSelect={(nextValue) => {
            setValues((currentValues) => ({ ...currentValues, profession: nextValue }));
          }}
        />

        <SingleChoiceGroup
          label="Ana Uzmanlık"
          options={networkingFilterOptions.interestAreas}
          selectedValue={values.interestArea}
          onSelect={(nextValue) => {
            setValues((currentValues) => ({ ...currentValues, interestArea: nextValue }));
          }}
        />

        <MultiChoiceGroup
          label="Ek Diş Hekimliği Alanları"
          helper={`En fazla ${networkingSelectionLimits.dentistryFocusAreas} seçim`}
          options={networkingFilterOptions.dentistryFocusAreas}
          selectedValues={values.dentistryFocusAreas}
          onToggle={(nextValue) => {
            setValues((currentValues) => ({
              ...currentValues,
              dentistryFocusAreas: toggleListValue(
                currentValues.dentistryFocusAreas,
                nextValue,
                networkingSelectionLimits.dentistryFocusAreas
              )
            }));
          }}
        />

        <SingleChoiceGroup
          label="Kariyer Yönü"
          options={networkingFilterOptions.futurePaths}
          selectedValue={values.futurePath}
          onSelect={(nextValue) => {
            setValues((currentValues) => ({ ...currentValues, futurePath: nextValue }));
          }}
        />
      </FormSection>

      <FormSection
        icon={<MapPinned color={colors.copper} size={18} />}
        title="Konum ve Kurum"
        subtitle="Aynı şehir ve benzer ekosistemlerdeki kişilerle yakalanma şansını artırır."
      >
        <Field
          label="Şehir"
          placeholder="İstanbul"
          value={values.city}
          onChangeText={(nextValue) => {
            setValues((currentValues) => ({ ...currentValues, city: nextValue }));
          }}
        />

        <Field
          label="Kurum / Klinik"
          placeholder="Kendi kliniğim / Üniversite / Zincir klinik"
          value={values.institutionName}
          onChangeText={(nextValue) => {
            setValues((currentValues) => ({ ...currentValues, institutionName: nextValue }));
          }}
        />

        <Field
          label="Deneyim Yılı"
          placeholder="8"
          keyboardType="number-pad"
          value={values.yearsExperience}
          onChangeText={(nextValue) => {
            setValues((currentValues) => ({
              ...currentValues,
              yearsExperience: nextValue.replace(/[^0-9]/g, "")
            }));
          }}
        />
      </FormSection>

      <FormSection
        icon={<Users color={colors.accent} size={18} />}
        title="Networking Hedefleri"
        subtitle="Kimi neden tanımak istediğini sistemin anlamasını sağlar."
      >
        <MultiChoiceGroup
          label="İşbirliği Hedefleri"
          helper={`En fazla ${networkingSelectionLimits.collaborationGoals} seçim`}
          options={networkingFilterOptions.collaborationGoals}
          selectedValues={values.collaborationGoals}
          onToggle={(nextValue) => {
            setValues((currentValues) => ({
              ...currentValues,
              collaborationGoals: toggleListValue(
                currentValues.collaborationGoals,
                nextValue,
                networkingSelectionLimits.collaborationGoals
              )
            }));
          }}
        />

        <SingleChoiceGroup
          label="Görüşme Uygunluğu"
          options={networkingFilterOptions.availability}
          selectedValue={values.availability}
          onSelect={(nextValue) => {
            setValues((currentValues) => ({ ...currentValues, availability: nextValue }));
          }}
        />
      </FormSection>

      <FormSection
        icon={<NotebookTabs color={colors.copper} size={18} />}
        title="Uzmanlık Konuları"
        subtitle="Vaka dili, teknoloji ilgisi ve ortak merak alanları burada yakalanır."
      >
        <MultiChoiceGroup
          label="İlgi Başlıkları"
          helper={`En fazla ${networkingSelectionLimits.topics} seçim`}
          options={networkingFilterOptions.topics}
          selectedValues={values.topics}
          onToggle={(nextValue) => {
            setValues((currentValues) => ({
              ...currentValues,
              topics: toggleListValue(
                currentValues.topics,
                nextValue,
                networkingSelectionLimits.topics
              )
            }));
          }}
        />
      </FormSection>

      <FormSection
        icon={<Globe2 color={colors.accent} size={18} />}
        title="Dil ve Kısa Tanıtım"
        subtitle="Bio tonu ve diller kartının profesyonel çekimini belirler."
      >
        <MultiChoiceGroup
          label="Konuşulan Diller"
          helper={`En fazla ${networkingSelectionLimits.languages} seçim`}
          options={networkingFilterOptions.languages}
          selectedValues={values.languages}
          onToggle={(nextValue) => {
            setValues((currentValues) => ({
              ...currentValues,
              languages: toggleListValue(
                currentValues.languages,
                nextValue,
                networkingSelectionLimits.languages
              )
            }));
          }}
        />

        <Field
          label="Kısa Tanıtım"
          placeholder="Odaklandığınız alanları ve hangi iş birliklerine açık olduğunuzu kısaca yazın."
          multiline
          numberOfLines={5}
          value={values.bio}
          onChangeText={(nextValue) => {
            setValues((currentValues) => ({ ...currentValues, bio: nextValue }));
          }}
        />
      </FormSection>

      <FormSection
        icon={<BriefcaseBusiness color={colors.copper} size={18} />}
        title="Eşleşme Sonrası Kanallar"
        subtitle="İletişim butonları ancak karşılıklı ilgi oluşunca açılır."
      >
        <Field
          label="Instagram"
          placeholder="@kullaniciadi"
          value={values.instagram}
          onChangeText={(nextValue) => {
            setValues((currentValues) => ({ ...currentValues, instagram: nextValue }));
          }}
          leftIcon={<Instagram color="#C13584" size={16} />}
        />

        <Field
          label="LinkedIn"
          placeholder="linkedin.com/in/kullaniciadi"
          value={values.linkedin}
          onChangeText={(nextValue) => {
            setValues((currentValues) => ({ ...currentValues, linkedin: nextValue }));
          }}
          leftIcon={<Linkedin color="#0A66C2" size={16} />}
        />
      </FormSection>

      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={() => {
          onSubmit(values);
        }}
        style={({ pressed }) => [
          styles.submitButton,
          !canSubmit ? styles.submitButtonDisabled : null,
          pressed && canSubmit ? styles.submitButtonPressed : null
        ]}
      >
        <ShieldCheck color="#FFFFFF" size={18} />
        <Text style={styles.submitButtonText}>{busy ? "Kaydediliyor..." : submitLabel}</Text>
      </Pressable>
    </View>
  );
}

type FormSectionProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
};

function FormSection({ icon, title, subtitle, children }: FormSectionProps) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>{icon}</View>
        <View style={styles.sectionTextBlock}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

type FieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "number-pad";
  multiline?: boolean;
  numberOfLines?: number;
  leftIcon?: ReactNode;
};

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  multiline = false,
  numberOfLines,
  leftIcon
}: FieldProps) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, multiline ? styles.inputShellMultiline : null]}>
        {leftIcon ? <View style={styles.inputIcon}>{leftIcon}</View> : null}
        <TextInput
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkMuted}
          style={[styles.input, multiline ? styles.inputMultiline : null]}
          textAlignVertical={multiline ? "top" : "center"}
          value={value}
        />
      </View>
    </View>
  );
}

type SingleChoiceGroupProps = {
  label: string;
  options: readonly string[];
  selectedValue: string;
  onSelect: (value: string) => void;
  helper?: string;
};

function SingleChoiceGroup({
  label,
  options,
  selectedValue,
  onSelect,
  helper
}: SingleChoiceGroupProps) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={selectedValue === option}
            onPress={() => {
              onSelect(option);
            }}
          />
        ))}
      </View>
    </View>
  );
}

type MultiChoiceGroupProps = {
  label: string;
  options: readonly string[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  helper?: string;
};

function MultiChoiceGroup({
  label,
  options,
  selectedValues,
  onToggle,
  helper
}: MultiChoiceGroupProps) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={selectedValues.includes(option)}
            onPress={() => {
              onToggle(option);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overviewCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...shadows
  },
  overviewHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  overviewTextBlock: {
    flex: 1,
    paddingRight: spacing.md
  },
  overviewTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 20,
    fontWeight: "700"
  },
  overviewSubtitle: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs
  },
  completenessBadge: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  completenessText: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 16,
    fontWeight: "800"
  },
  visibilityRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  visibilityTextBlock: {
    flex: 1,
    paddingRight: spacing.md
  },
  visibilityTitle: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "800"
  },
  visibilitySubtitle: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...shadows
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    marginBottom: spacing.md
  },
  sectionIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    height: 40,
    justifyContent: "center",
    marginRight: spacing.md,
    width: 40
  },
  sectionTextBlock: {
    flex: 1
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "700"
  },
  sectionSubtitle: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4
  },
  fieldBlock: {
    marginTop: spacing.md
  },
  fieldLabel: {
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8
  },
  fieldHelper: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10
  },
  inputShell: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 54,
    paddingHorizontal: spacing.md
  },
  inputShellMultiline: {
    alignItems: "flex-start",
    paddingTop: 14
  },
  inputIcon: {
    marginRight: 10,
    marginTop: 2
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontFamily: typography.body,
    fontSize: 15,
    minHeight: 22,
    paddingVertical: 0
  },
  inputMultiline: {
    minHeight: 110
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  helperText: {
    color: colors.inkMuted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.md
  },
  errorText: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.backgroundDeep,
    borderRadius: radii.md,
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16
  },
  submitButtonDisabled: {
    opacity: 0.5
  },
  submitButtonPressed: {
    opacity: 0.86
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontFamily: typography.body,
    fontSize: 15,
    fontWeight: "800",
    marginLeft: 10
  }
});
