import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/theme';

interface Props {
  title: string;
  actionLabel?: string;
}

export function SectionHeader({ title, actionLabel }: Props) {
  return (
    <View style={styles.row}>
      <Text style={typography.titleSm}>{title}</Text>
      {actionLabel ? <Text style={styles.action}>{actionLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  action: {
    ...typography.labelMd,
    color: colors.surfaceBrand,
  },
});
