import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { getVendorForOwner, listVendorServices, removeVendorService, upsertVendorService } from '@/lib/vendor-admin';

const schema = z.object({
  title: z.string().min(2),
  category: z.string().min(2),
  durationMinutes: z.string(),
  price: z.string(),
});

type FormValues = z.infer<typeof schema>;

export default function VendorServicesScreen() {
  const queryClient = useQueryClient();
  const { data: vendor } = useQuery({
    queryKey: ['vendor-self'],
    queryFn: getVendorForOwner,
  });
  const vendorId = vendor?.id;
  const { data: services = [] } = useQuery({
    queryKey: ['vendor-services'],
    queryFn: listVendorServices,
  });

  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      title: '',
      category: 'tire',
      durationMinutes: '45',
      price: '95',
    },
    resolver: zodResolver(schema),
  });

  const submit = handleSubmit(async (values) => {
    if (!vendorId) return;
    await upsertVendorService({
      id: `service-${Date.now()}`,
      vendorId,
      title: values.title,
      category: values.category as never,
      durationMinutes: Number(values.durationMinutes),
      price: Number(values.price),
      active: true,
    });
    await queryClient.invalidateQueries({ queryKey: ['vendor-services'] });
    reset();
  });

  return (
    <Screen>
      <Text style={typography.titleLg}>Service management</Text>
      <Text style={styles.subtitle}>Add, edit, and remove the services you want to expose in the marketplace.</Text>

      <AppCard style={styles.formCard}>
        {(['title', 'category', 'durationMinutes', 'price'] as const).map((field) => (
          <Controller
            key={field}
            control={control}
            name={field}
            render={({ field: controller }) => (
              <TextInput
                style={styles.input}
                placeholder={field}
                value={controller.value}
                onChangeText={controller.onChange}
                placeholderTextColor={colors.textTertiary}
              />
            )}
          />
        ))}
        <AppButton label="Add Service" variant="accent" onPress={submit} />
      </AppCard>

      {services.length ? (
        services.map((service) => (
          <AppCard key={service.id} style={styles.serviceCard}>
            <View>
              <Text style={typography.titleSm}>{service.title}</Text>
              <Text style={styles.subtitle}>{service.durationMinutes} mins · ${service.price}</Text>
            </View>
            <View style={styles.actions}>
              <AppButton label="Delete" variant="destructive" style={styles.actionButton} onPress={async () => {
                await removeVendorService(service.id);
                await queryClient.invalidateQueries({ queryKey: ['vendor-services'] });
              }} />
            </View>
          </AppCard>
        ))
      ) : (
        <EmptyState title="No services configured" body="Add your first service to start appearing in discovery results." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
  },
  formCard: {
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.bgBase,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    color: colors.textPrimary,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    minHeight: 44,
  },
});
