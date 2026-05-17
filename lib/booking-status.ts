import { colors } from '@/constants/theme';
import { BookingRecord } from '@/types/domain';

export const STATUS_LABEL: Record<BookingRecord['status'], string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS: Record<BookingRecord['status'], { bg: string; fg: string }> = {
  pending:   { bg: colors.surfaceSubtleOrange, fg: colors.surfaceAccent },
  confirmed: { bg: '#EBF3FC',                  fg: colors.surfaceBrand },
  completed: { bg: colors.surfaceSubtleGreen,  fg: colors.surfaceSuccess },
  cancelled: { bg: '#FEE2E2',                  fg: colors.danger },
};
