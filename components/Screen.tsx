import React, { ReactNode } from 'react';
import { RefreshControlProps, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export function Screen({ children, scroll = true, contentStyle, refreshControl }: Props) {
  const content = scroll ? (
    <ScrollView style={styles.fill} contentContainerStyle={[styles.content, contentStyle]} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
  );

  return <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  fill: {
    flex: 1,
  },
  content: {
    padding: spacing.page,
    gap: spacing.xl,
  },
});
