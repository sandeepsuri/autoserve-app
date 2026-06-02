import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { signIn, signInWithGoogle, signUp } from '@/lib/auth';
import { useAuthStore } from '@/store/useAuthStore';

const schema = z.object({
  fullName: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6),
});

type FormValues = z.infer<typeof schema>;

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [confirmationPending, setConfirmationPending] = useState(false);
  const postAuthPath = useAuthStore((state) => state.postAuthPath);
  const setGuestMode = useAuthStore((state) => state.setGuestMode);
  const setPostAuthPath = useAuthStore((state) => state.setPostAuthPath);

  const { control, handleSubmit, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
    },
    resolver: zodResolver(schema),
  });

  const handleSuccess = () => {
    const nextPath = postAuthPath;
    setGuestMode(false);
    setPostAuthPath(null);
    if (nextPath) {
      router.replace(nextPath as never);
    } else {
      router.replace('/(auth)/role');
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (mode === 'login') {
        await signIn(values.email, values.password);
        handleSuccess();
      } else {
        const result = await signUp(values.email, values.password, values.fullName || 'AutoServe User');
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
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor={colors.textTertiary}
              value={value}
              onChangeText={onChange}
            />
          )}
        />
      ) : null}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={colors.textTertiary}
            value={value}
            onChangeText={onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <TextInput
            secureTextEntry
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textTertiary}
            value={value}
            onChangeText={onChange}
          />
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
            const completed = await signInWithGoogle();
            if (completed) {
              handleSuccess();
            }
          } catch (error) {
            Alert.alert('Google sign-in failed', error instanceof Error ? error.message : 'Please try again.');
          }
        }}
      />
    </Screen>
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
});
