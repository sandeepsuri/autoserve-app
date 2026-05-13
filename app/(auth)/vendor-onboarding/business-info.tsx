import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { AppCard } from '@/components/AppCard';
import { AppTextField } from '@/components/AppTextField';
import { OnboardingStepShell } from '@/components/onboarding/OnboardingStepShell';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { saveVendorOnboardingDraft } from '@/lib/vendor-onboarding';
import { useAuthStore } from '@/store/useAuthStore';
import { useVendorOnboardingStore } from '@/store/useVendorOnboardingStore';

const schema = z.object({
  businessName: z.string().trim().min(2, 'Required'),
  contactName: z.string().trim().min(2, 'Required'),
  contactEmail: z.string().trim().email('Enter a valid email'),
  contactPhone: z.string().trim().min(7, 'Required'),
  description: z.string().trim().min(10, 'A short bio helps clients choose you'),
  website: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || v.length === 0 || /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/.test(v), {
      message: 'Enter a valid URL',
    }),
  socialHandle: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function BusinessInfoStep() {
  const { draft, patchDraft } = useVendorOnboardingStore();
  const { profile, session } = useAuthStore();

  const {
    control,
    handleSubmit,
    formState: { isValid, errors },
  } = useForm<FormValues>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: draft?.profile?.businessName ?? '',
      contactName: draft?.profile?.contactName ?? profile?.fullName ?? '',
      contactEmail: draft?.profile?.contactEmail ?? session?.email ?? '',
      contactPhone: draft?.profile?.contactPhone ?? '',
      description: draft?.profile?.description ?? '',
      website: draft?.profile?.website ?? '',
      socialHandle: draft?.profile?.socialHandle ?? '',
    },
  });

  const handleContinue = handleSubmit(async (values) => {
    await saveVendorOnboardingDraft({ profile: values });
  });

  return (
    <OnboardingStepShell
      stepId="business-info"
      title="Business profile"
      subtitle="Clients see this when browsing AutoServe. Clear basics build trust and bookings."
      canContinue={isValid}
      onContinue={handleContinue}
    >
      <AppCard style={styles.card}>
        <SectionHeader title="Identity" />
        <Controller
          control={control}
          name="businessName"
          render={({ field }) => (
            <AppTextField
              label="Business name"
              required
              value={field.value}
              onChangeText={(text) => {
                field.onChange(text);
                patchDraft({ profile: { businessName: text } });
              }}
              placeholder="e.g. Suri Auto & Tire"
              errorText={errors.businessName?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <AppTextField
              label="Business bio"
              required
              multiline
              value={field.value}
              onChangeText={(text) => {
                field.onChange(text);
                patchDraft({ profile: { description: text } });
              }}
              placeholder="Describe your specialties, experience, and what sets you apart…"
              helperText="Minimum 10 characters"
              errorText={errors.description?.message}
            />
          )}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <SectionHeader title="Contact" />
        <Controller
          control={control}
          name="contactName"
          render={({ field }) => (
            <AppTextField
              label="Contact name"
              required
              value={field.value}
              onChangeText={(text) => {
                field.onChange(text);
                patchDraft({ profile: { contactName: text } });
              }}
              placeholder="Your name or point-of-contact name"
              errorText={errors.contactName?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="contactEmail"
          render={({ field }) => (
            <AppTextField
              label="Business email"
              required
              value={field.value}
              onChangeText={(text) => {
                field.onChange(text);
                patchDraft({ profile: { contactEmail: text } });
              }}
              placeholder="bookings@yourbusiness.com"
              keyboardType="email-address"
              autoCapitalize="none"
              errorText={errors.contactEmail?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="contactPhone"
          render={({ field }) => (
            <AppTextField
              label="Phone number"
              required
              value={field.value}
              onChangeText={(text) => {
                field.onChange(text);
                patchDraft({ profile: { contactPhone: text } });
              }}
              placeholder="(555) 000-0000"
              keyboardType="phone-pad"
              errorText={errors.contactPhone?.message}
            />
          )}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <SectionHeader title="Online presence" actionLabel="Optional" />
        <Controller
          control={control}
          name="website"
          render={({ field }) => (
            <AppTextField
              label="Website"
              value={field.value ?? ''}
              onChangeText={(text) => {
                field.onChange(text);
                patchDraft({ profile: { website: text } });
              }}
              placeholder="yourbusiness.com"
              keyboardType="url"
              autoCapitalize="none"
              errorText={errors.website?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="socialHandle"
          render={({ field }) => (
            <AppTextField
              label="Social handle"
              value={field.value ?? ''}
              onChangeText={(text) => {
                field.onChange(text);
                patchDraft({ profile: { socialHandle: text } });
              }}
              placeholder="@yourbusiness"
              autoCapitalize="none"
            />
          )}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <SectionHeader title="Brand assets" actionLabel="Optional" />
        <Text style={styles.assetHelper}>
          Upload your logo and a storefront photo so clients can recognise your business instantly.
        </Text>
        <UploadTile label="Add logo" description="Square image, 500 × 500 px recommended" />
        <UploadTile label="Add cover image" description="Landscape, 1200 × 400 px recommended" />
        <Text style={styles.comingSoon}>Image upload coming in a future update.</Text>
      </AppCard>
    </OnboardingStepShell>
  );
}

function UploadTile({ label, description }: { label: string; description: string }) {
  return (
    <Pressable style={styles.uploadTile} disabled>
      <View style={styles.uploadIcon}>
        <Text style={styles.uploadPlus}>+</Text>
      </View>
      <View style={styles.uploadText}>
        <Text style={styles.uploadLabel}>{label}</Text>
        <Text style={styles.uploadDesc}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  assetHelper: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  uploadTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: 12,
    padding: spacing.lg,
    opacity: 0.6,
  },
  uploadIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPlus: {
    fontSize: 22,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  uploadText: {
    flex: 1,
    gap: spacing.xs,
  },
  uploadLabel: {
    ...typography.labelMd,
    color: colors.textPrimary,
  },
  uploadDesc: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  comingSoon: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
