import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '@/components/AppButton';
import { FilterChip } from '@/components/FilterChip';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { Service, ServiceCategory } from '@/types/domain';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  onClose: () => void;
  vendorName: string;
  mobileServiceEnabled?: boolean;
  services: Service[];
  onBook: () => void;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ServiceListCard({
  service,
  isFeatured,
  mobileServiceEnabled,
}: {
  service: Service;
  isFeatured: boolean;
  mobileServiceEnabled?: boolean;
}) {
  const modeLabel = mobileServiceEnabled ? 'Shop or mobile' : 'Shop visit';
  const modeIsGreen = Boolean(mobileServiceEnabled);

  return (
    <View style={[styles.card, isFeatured && styles.cardFeatured]}>
      {/* Accent bar — sits flush at the top, no seam because overflow:hidden on card */}
      <View style={[styles.accentBar, isFeatured ? styles.accentBarOrange : styles.accentBarBrand]} />
      <View style={styles.cardInner}>
        {/* Top row: copy + price stack */}
        <View style={styles.cardTop}>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>{service.title}</Text>
            {service.description ? (
              <Text style={styles.cardDescription} numberOfLines={3}>
                {service.description}
              </Text>
            ) : null}
          </View>
          <View style={styles.priceStack}>
            {service.price != null ? (
              <Text style={styles.priceAmount}>${service.price}</Text>
            ) : null}
            {service.durationMinutes != null ? (
              <Text style={styles.priceDuration}>{service.durationMinutes} mins</Text>
            ) : null}
          </View>
        </View>

        {/* Meta chips */}
        <View style={styles.metaRow}>
          <View style={[styles.metaChip, modeIsGreen && styles.metaChipGreen]}>
            <Text style={[styles.metaChipText, modeIsGreen && styles.metaChipTextGreen]}>
              {modeLabel}
            </Text>
          </View>
          {service.category ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{capitalize(service.category)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function AllServicesSheet({ visible, onClose, vendorName, mobileServiceEnabled, services, onBook }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | ServiceCategory>('all');

  // Derive unique categories from the service list
  const categories = useMemo<ServiceCategory[]>(() => {
    const seen = new Set<ServiceCategory>();
    for (const s of services) {
      if (s.category) seen.add(s.category);
    }
    return Array.from(seen);
  }, [services]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of services) {
      if (s.category) counts[s.category] = (counts[s.category] ?? 0) + 1;
    }
    return counts;
  }, [services]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      const matchesCategory = activeCategory === 'all' || s.category === activeCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [services, search, activeCategory]);

  const subtitle = `${vendorName} offers ${services.length} bookable ${services.length === 1 ? 'service' : 'services'}. Compare price, duration, and mode before booking.`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Outer container pins the sheet to the bottom */}
      <View style={styles.overlay}>
        {/* Scrim: absolutely-filled behind the sheet; tapping it closes the sheet.
            Kept out of the sheet subtree so it never intercepts list scroll gestures. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* Sheet: a plain View (not a Pressable) so the FlatList owns its pan gestures */}
        <View style={styles.sheet}>
          {/* Grabber */}
          <View style={styles.grabberRow}>
            <View style={styles.grabber} />
          </View>

          {/* Header section */}
          <View style={styles.sheetHeader}>
            <View style={styles.titleRow}>
              <View style={styles.titleBlock}>
                <Text style={styles.sheetTitle}>All services</Text>
                <Text style={styles.sheetSubtitle}>{subtitle}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.surfaceBrand} />
              </Pressable>
            </View>

            {/* Search box */}
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={17} color={colors.surfaceBrand} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search services"
                placeholderTextColor={colors.textTertiary}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
          </View>

          {/* Category chips row */}
          <View style={styles.categoryBorder}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              <FilterChip
                label="All"
                active={activeCategory === 'all'}
                onPress={() => setActiveCategory('all')}
                count={services.length}
              />
              {categories.map((cat) => (
                <FilterChip
                  key={cat}
                  label={capitalize(cat)}
                  active={activeCategory === cat}
                  onPress={() => setActiveCategory(cat)}
                  count={categoryCounts[cat]}
                />
              ))}
            </ScrollView>
          </View>

          {/* Scrollable service list — flex:1 so it expands and only this area scrolls */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyState}>
                {services.length === 0 ? (
                  <>
                    <Text style={styles.emptyTitle}>No services listed</Text>
                    <Text style={styles.emptyBody}>This shop has no listed services yet.</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyTitle}>No matches</Text>
                    <Text style={styles.emptyBody}>No services match your search or filter.</Text>
                  </>
                )}
              </View>
            }
            renderItem={({ item, index }) => (
              <ServiceListCard
                service={item}
                isFeatured={index === 0}
                mobileServiceEnabled={mobileServiceEnabled}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          />

          {/* Footer */}
          <View style={styles.footer}>
            <AppButton
              label="Close"
              variant="secondary"
              onPress={onClose}
              style={styles.footerButton}
            />
            <AppButton
              label="Book Appointment"
              variant="accent"
              onPress={onBook}
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11,18,32,0.34)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgBase,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    // Definite height (not maxHeight) so the flex:1 list has space to fill and scroll
    height: SCREEN_HEIGHT * 0.88,
    flexDirection: 'column',
    ...shadows.card,
  },
  list: {
    flex: 1,
  },

  // Grabber
  grabberRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  grabber: {
    width: 48,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.borderStrong,
  },

  // Header
  sheetHeader: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  sheetTitle: {
    ...typography.titleMd,
    fontSize: 24,
    lineHeight: 28,
  },
  sheetSubtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: colors.textPrimary,
    paddingVertical: 0,
  },

  // Categories
  categoryBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.md,
  },

  // List
  listContent: {
    padding: spacing.page,
    paddingBottom: spacing.xxl,
  },
  listSeparator: {
    height: spacing.lg,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.section,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.titleSm,
  },
  emptyBody: {
    ...typography.bodyMd,
    textAlign: 'center',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    backgroundColor: colors.bgBase,
  },
  footerButton: {
    flex: 1,
    minHeight: 48,
  },

  // Service card
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardFeatured: {
    borderColor: 'rgba(255,122,26,0.35)',
  },
  accentBar: {
    height: 7,
    width: '100%',
  },
  accentBarOrange: {
    backgroundColor: colors.surfaceAccent,
  },
  accentBarBrand: {
    backgroundColor: colors.surfaceBrand,
  },
  cardInner: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
  },
  cardCopy: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 0,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  cardDescription: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  priceStack: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    flexShrink: 0,
  },
  priceAmount: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  priceDuration: {
    ...typography.caption,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: colors.textTertiary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaChip: {
    borderRadius: radius.full,
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  metaChipGreen: {
    backgroundColor: colors.surfaceSubtleGreen,
    borderColor: '#BBF7D0',
  },
  metaChipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  metaChipTextGreen: {
    color: colors.completed,
  },
});
