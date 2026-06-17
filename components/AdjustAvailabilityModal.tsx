/**
 * Ticket 2 — Adjust Availability Modal Shell
 *
 * A bottom-sheet modal with 4 tabs: Change date, Quick controls, Weekly rules, Blocked.
 * Each tab renders its content from a dedicated child component (Tickets 3 & 4).
 * The sheet opens over vendor bookings so the queue context stays visible behind it.
 *
 * Props:
 *   visible    — whether the sheet is showing
 *   onClose    — called on close/discard
 */

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { BlockedTab } from '@/components/availability/BlockedTab';
import { ChangeDateTab } from '@/components/availability/ChangeDateTab';
import { QuickControlsTab } from '@/components/availability/QuickControlsTab';
import { WeeklyRulesTab } from '@/components/availability/WeeklyRulesTab';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { saveVendorAvailability, validateAvailability } from '@/lib/vendor-availability';
import { useVendorAvailabilityStore } from '@/store/useVendorAvailabilityStore';

type AvailabilityTab = 'change-date' | 'quick-controls' | 'weekly-rules' | 'blocked';

const TABS: { id: AvailabilityTab; label: string }[] = [
  { id: 'change-date', label: 'Change date' },
  { id: 'quick-controls', label: 'Quick controls' },
  { id: 'weekly-rules', label: 'Weekly rules' },
  { id: 'blocked', label: 'Blocked' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Resolved vendor id for the signed-in owner. Passed so save/load don't rely on an owner lookup. */
  vendorId?: string;
}

export function AdjustAvailabilityModal({ visible, onClose, vendorId }: Props) {
  const { draft, openDraft, saveDraft, discardDraft, availability } = useVendorAvailabilityStore();
  const [activeTab, setActiveTab] = React.useState<AvailabilityTab>('change-date');
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const blockedCount = (draft ?? availability).blockedPeriods.length;

  const handleOpen = () => {
    openDraft();
    setSaveError(null);
    setActiveTab('change-date');
  };

  const handleDiscard = () => {
    discardDraft();
    onClose();
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Validate before sending to backend
      const validationErrors = validateAvailability(draft);
      if (validationErrors.length) {
        setSaveError(validationErrors[0].message);
        return;
      }
      // Persist to backend (or demo store). Pass the resolved vendorId so the
      // save doesn't depend on an owner lookup that can come back empty.
      const { conflicts } = await saveVendorAvailability(draft, vendorId);
      // Commit draft to local store
      saveDraft();
      if (conflicts.length) {
        // Surface conflict warning but still close — bookings are never deleted
        setSaveError(
          `Saved. Note: ${conflicts.length} pending booking${conflicts.length > 1 ? 's' : ''} may now fall outside your new availability window. Review them in your bookings queue.`,
        );
        // Keep sheet open briefly so vendor can read the warning
        setTimeout(() => onClose(), 3500);
      } else {
        onClose();
      }
    } catch (err) {
      // Log the raw error and surface its real message — Supabase PostgrestErrors
      // are plain objects, not Error instances, so don't hide them behind a generic string.
      console.error('[AdjustAvailability] save failed:', err);
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string } | null)?.message ?? 'Could not save changes. Please try again.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={handleDiscard}
      onShow={handleOpen}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleDiscard} accessibilityLabel="Close availability editor" />

        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          {/* Grabber */}
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              <View style={styles.sheetTitleBlock}>
                <Text style={styles.sheetTitle}>Adjust availability</Text>
                <Text style={styles.sheetSubtitle}>Change upcoming slots without leaving your queue.</Text>
              </View>
              <Pressable
                onPress={handleDiscard}
                style={styles.closeBtn}
                hitSlop={8}
                accessibilityLabel="Close availability editor"
                accessibilityRole="button"
              >
                <Text style={styles.closeX}>✕</Text>
              </Pressable>
            </View>

            {/* Tab nav */}
            <View style={styles.tabRow}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const count = tab.id === 'blocked' && blockedCount > 0 ? blockedCount : undefined;
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={[styles.tab, isActive && styles.tabActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
                      {tab.label}
                      {count !== undefined ? ` ${count}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {activeTab === 'change-date' ? <ChangeDateTab /> : null}
            {activeTab === 'quick-controls' ? <QuickControlsTab /> : null}
            {activeTab === 'weekly-rules' ? <WeeklyRulesTab /> : null}
            {activeTab === 'blocked' ? <BlockedTab /> : null}

            {saveError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{saveError}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Sticky footer */}
          <View style={styles.footer}>
            <AppButton
              label="Discard"
              variant="secondary"
              style={styles.footerBtn}
              onPress={handleDiscard}
              disabled={saving}
            />
            <AppButton
              label={saving ? 'Saving…' : 'Save changes'}
              variant="accent"
              style={styles.footerBtn}
              onPress={handleSave}
              disabled={saving}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,18,32,0.45)',
  },
  sheet: {
    backgroundColor: colors.bgBase,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    shadowColor: '#0F172A',
    shadowOpacity: 0.25,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -10 },
    elevation: 20,
  },
  grabber: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
    gap: spacing.md,
    backgroundColor: colors.bgBase,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  sheetTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  sheetTitle: {
    ...typography.titleMd,
    color: colors.textPrimary,
  },
  sheetSubtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  closeX: {
    ...typography.labelLg,
    color: colors.textSecondary,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.bgStrong,
    borderColor: colors.bgStrong,
  },
  tabLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.textInverse,
  },
  body: {
    // NOT flex:1 — the sheet sizes to its content (capped at maxHeight), so a
    // flexBasis:0 child would collapse to zero height. flexShrink lets the
    // ScrollView size to its content and scroll internally when it hits the cap.
    flexShrink: 1,
  },
  bodyContent: {
    padding: spacing.page,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
  },
  footerBtn: {
    flex: 1,
  },
  errorBox: {
    backgroundColor: colors.surfaceSubtleOrange,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    ...typography.bodyMd,
    color: colors.pending,
  },
});
