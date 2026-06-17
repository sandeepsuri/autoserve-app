import { KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
  errorText?: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: string;
  secureTextEntry?: boolean;
  maxLength?: number;
  onBlur?: () => void;
}

export function AppTextField({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  helperText,
  errorText,
  multiline,
  numberOfLines = 4,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  maxLength,
  onBlur,
}: Props) {
  const hasError = Boolean(errorText);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.asterisk}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        onBlur={onBlur}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : undefined}
        textAlignVertical={multiline ? 'top' : undefined}
        style={[styles.input, multiline && styles.inputMultiline, hasError && styles.inputError]}
      />
      {hasError ? (
        <Text style={styles.errorText}>{errorText}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    ...typography.labelMd,
    color: colors.textPrimary,
  },
  asterisk: {
    color: colors.surfaceAccent,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    color: colors.textPrimary,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: spacing.lg,
  },
  inputError: {
    borderColor: colors.danger,
  },
  helperText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
});
