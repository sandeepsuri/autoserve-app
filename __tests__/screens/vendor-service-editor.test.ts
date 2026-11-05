import React from 'react';
import VendorServicesScreen from '@/app/(vendor)/services';
import { AppButton } from '@/components/AppButton';
import { AppTextField } from '@/components/AppTextField';

const { act, create } = jest.requireActual('react-test-renderer');
const mockSave = jest.fn();
const mockInvalidate = jest.fn();
const mockService = {
  id: '11111111-1111-4111-8111-111111111111', vendorId: 'vendor-1', title: 'Oil Change',
  category: 'oil', price: 50, durationMinutes: 30, active: true,
  description: 'Retain original details', image: 'oil.jpg',
};
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
  useQuery: ({ queryKey }: any) => ({ data: queryKey[0] === 'vendor-services' ? [mockService] : [], refetch: jest.fn() }),
}));
jest.mock('@/lib/use-vendor-identity', () => ({ useVendorIdentity: () => ({ data: { id: 'vendor-1', name: 'Shop' } }) }));
jest.mock('@/lib/vendor-admin', () => ({ upsertVendorService: (value: any) => mockSave(value) }));
jest.mock('@/lib/bookings', () => ({ listBookingsForVendorOwner: jest.fn() }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (selector: any) => selector({ session: { userId: 'owner-1' } }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));

beforeEach(() => { jest.clearAllMocks(); mockSave.mockResolvedValue(mockService); });

test.each(['add', 'edit'])('%s service accepts spaces during typing and trims on submit', async (mode) => {
  let screen: any;
  await act(async () => { screen = create(React.createElement(VendorServicesScreen)); });
  const control = mode === 'add'
    ? screen.root.findByProps({ accessibilityLabel: 'Add a new service' })
    : screen.root.findByProps({ accessibilityLabel: 'Edit Oil Change' });
  await act(async () => { control.props.onPress(); });
  const nameField = () => screen.root.findAllByType(AppTextField).find((node: any) => node.props.label === 'Service name');
  await act(async () => { nameField().props.onChangeText(''); });
  for (const character of '  Full  Synthetic Oil Change  ') {
    await act(async () => { nameField().props.onChangeText(nameField().props.value + character); });
  }
  expect(nameField().props.value).toBe('  Full  Synthetic Oil Change  ');
  const save = screen.root.findAllByType(AppButton).find((node: any) => node.props.label === (mode === 'add' ? 'Add service' : 'Save changes'));
  await act(async () => { await save.props.onPress(); });
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Full  Synthetic Oil Change' }));
  if (mode === 'edit') expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ description: mockService.description, image: mockService.image }));
  expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['vendor-detail', 'vendor-1'] });
  await act(async () => { screen.unmount(); });
});
