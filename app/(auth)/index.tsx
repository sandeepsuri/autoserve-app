import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { signIn, signInWithGoogle, signUp } from '@/lib/auth';
import { emailSchema, sanitizeName } from '@/lib/validation';
import { useAuthStore } from '@/store/useAuthStore';

const schema = z.object({
  fullName: z
    .string()
    .trim()
    .max(60, 'Name must be 60 characters or fewer')
    .refine((value) => !/[<>]/.test(value), { message: 'Name contains invalid characters' })
    .optional(),
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters').max(72, 'Password must be 72 characters or fewer'),
});

type FormValues = z.infer<typeof schema>;

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const postAuthPath = useAuthStore((state) => state.postAuthPath);
  const setGuestMode = useAuthStore((state) => state.setGuestMode);
  const setPostAuthPath = useAuthStore((state) => state.setPostAuthPath);

  const { control, handleSubmit, formState: { isSubmitting, errors } } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
    },
    resolver: zodResolver(schema),
  });

  const handleSuccess = () => {
    const nextPath = postAuthPath;
    const profile = useAuthStore.getState().profile;

    setGuestMode(false);

    if (profile?.role === 'client') {
      setPostAuthPath(null);
      router.replace((nextPath as never) || '/(client)');
    } else if (profile?.role === 'vendor') {
      setPostAuthPath(null);
      router.replace('/(vendor)');
    } else {
      // Keep postAuthPath until role selection consumes it. Guest booking
      // flows sign in here, then role selection returns clients to the draft.
      router.replace('/(auth)/role');
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    const email = values.email.trim().toLowerCase();
    const fullName = values.fullName ? sanitizeName(values.fullName) : '';
    try {
      if (mode === 'login') {
        await signIn(email, values.password);
        handleSuccess();
      } else {
        const result = await signUp(email, values.password, fullName || 'AutoServe User');
        if (result.needsConfirmation) {
          setConfirmationPending(true);
        } else {
          handleSuccess();
        }
      }
    } catch (error) {
      Alert.alert('Authentication failed', error instanceof Error ? error.message : 'Please try again.');
    }
  });

  return (
    <>
    <Screen contentStyle={styles.container}>
      <AppHeader
        title={mode === 'login' ? 'Welcome back' : 'Create your AutoServe account'}
        subtitle="Use email or Google to manage bookings across iOS and Android."
        fallbackHref="/(public)/welcome"
      />

      <View style={styles.toggleRow}>
        <AppButton label="Log In" variant={mode === 'login' ? 'primary' : 'secondary'} style={styles.half} onPress={() => setMode('login')} />
        <AppButton label="Sign Up" variant={mode === 'signup' ? 'primary' : 'secondary'} style={styles.half} onPress={() => setMode('signup')} />
      </View>

      {mode === 'signup' ? (
        <Controller
          control={control}
          name="fullName"
          render={({ field: { onChange, value } }) => (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={colors.textTertiary}
                value={value}
                onChangeText={onChange}
                maxLength={60}
              />
              {errors.fullName?.message ? <Text style={styles.fieldError}>{errors.fullName.message}</Text> : null}
            </View>
          )}
        />
      ) : null}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <View>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={colors.textTertiary}
              value={value}
              onChangeText={onChange}
              maxLength={120}
            />
            {errors.email?.message ? <Text style={styles.fieldError}>{errors.email.message}</Text> : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <View>
            <TextInput
              secureTextEntry
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textTertiary}
              value={value}
              onChangeText={onChange}
              maxLength={72}
            />
            {errors.password?.message ? <Text style={styles.fieldError}>{errors.password.message}</Text> : null}
          </View>
        )}
      />

      {confirmationPending ? (
        <Text style={styles.confirmation}>Check your email to confirm your account before signing in.</Text>
      ) : null}
      <AppButton label={isSubmitting ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'} onPress={onSubmit} variant="accent" />
      <AppButton
        label="Continue with Google"
        variant="secondary"
        onPress={async () => {
          try {
            setGoogleLoading(true);
            const completed = await signInWithGoogle();
            setGoogleLoading(false);
            if (completed) {
              handleSuccess();
            }
          } catch (error) {
            setGoogleLoading(false);
            Alert.alert('Google sign-in failed', error instanceof Error ? error.message : 'Please try again.');
          }
        }}
      />
    </Screen>
      <Modal visible={googleLoading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.textPrimary} />
          <Text style={styles.loadingText}>Signing in...</Text>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  confirmation: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fieldError: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    color: colors.textPrimary,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 18, 32, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodyMd,
    color: colors.textPrimary,
  },
});
