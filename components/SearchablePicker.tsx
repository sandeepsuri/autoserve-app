import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

const DROPDOWN_MAX_HEIGHT = 280;

interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string }[];
  isLoading?: boolean;
  placeholder?: string;
  required?: boolean;
  errorText?: string;
  disabled?: boolean;
  disabledHelperText?: string;
  onBlur?: (value: string) => void;
}

export function SearchablePicker({
  label,
  value,
  onChange,
  options,
  isLoading,
  placeholder,
  required,
  errorText,
  disabled,
  disabledHelperText,
  onBlur,
}: Props) {
  const [open, setOpen] = useState(false);
  const hasError = Boolean(errorText);

  const lc = value.trim().toLowerCase();
  const filtered = lc
    ? options.filter((o) => o.label.toLowerCase().includes(lc))
    : options;

  const exactMatch = options.some((o) => o.label.toLowerCase() === lc);
  const showManualFallback = value.trim().length > 0 && !exactMatch;
  const showDropdown = open && !disabled;

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    onBlur?.(val);
  };

  const handleBlur = () => {
    // delay so taps on dropdown items register before focus leaves
    setTimeout(() => {
      setOpen(false);
      onBlur?.(value);
    }, 150);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.asterisk}> *</Text> : null}
      </Text>

      <TextInput
        value={value}
        onChangeText={(text) => {
          if (!disabled) {
            onChange(text);
            setOpen(true);
          }
        }}
        placeholder={disabled && disabledHelperText ? disabledHelperText : placeholder}
        placeholderTextColor={colors.textTertiary}
        editable={!disabled}
        onFocus={() => { if (!disabled) setOpen(true); }}
        onBlur={handleBlur}
        style={[
          styles.input,
          hasError && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
      />

      {hasError ? (
        <Text style={styles.errorText}>{errorText}</Text>
      ) : null}

      {showDropdown ? (
        <View style={styles.dropdown}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.surfaceAccent} style={styles.spinner} />
          ) : (
            <ScrollView
              style={styles.dropdownScroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {filtered.map((item) => (
                <Pressable
                  key={item.label}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                  onPress={() => handleSelect(item.label)}
                >
                  <Text style={styles.itemText}>{item.label}</Text>
                </Pressable>
              ))}

              {showManualFallback ? (
                <Pressable
                  style={({ pressed }) => [styles.item, styles.itemManual, pressed && styles.itemPressed]}
                  onPress={() => handleSelect(value.trim())}
                >
                  <Text style={styles.itemManualText}>{`+ Use "${value.trim()}"`}</Text>
                </Pressable>
              ) : null}

              {filtered.length === 0 && !showManualFallback ? (
                <Text style={styles.emptyText}>No options — type to enter manually</Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
    // zIndex so the dropdown floats over sibling fields
    zIndex: 10,
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
  inputError: {
    borderColor: colors.danger,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  dropdown: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: DROPDOWN_MAX_HEIGHT,
  },
  spinner: {
    paddingVertical: spacing.lg,
  },
  item: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  itemPressed: {
    backgroundColor: colors.bgBase,
  },
  itemText: {
    ...typography.bodyMd,
    color: colors.textPrimary,
  },
  itemManual: {
    borderBottomWidth: 0,
    backgroundColor: colors.surfaceSubtleOrange,
  },
  itemManualText: {
    ...typography.labelMd,
    color: colors.surfaceAccent,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
