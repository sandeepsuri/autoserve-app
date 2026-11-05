import React from 'react';
import { Text } from 'react-native';
import VendorServicesScreen from '@/app/(vendor)/services';
import { AppButton } from '@/components/AppButton';
import { AppTextField } from '@/components/AppTextField';
import { FilterChip } from '@/components/FilterChip';

const { act, create } = jest.requireActual('react-test-renderer');
const mockSave = jest.fn();
const mockInvalidate = jest.fn();
const mockService = {
  id: '11111111-1111-4111-8111-111111111111', vendorId: 'vendor-1', title: 'Oil Change',
  category: 'oil', price: 50, durationMinutes: 30, active: true, bookingEligibility: 'both',
  description: 'Retain original details', image: 'oil.jpg',
};
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
  useQuery: ({ queryKey }: any) => ({ data: queryKey[0] === 'vendor-services' ? [mockService] : [], refetch: jest.fn() }),
}));
jest.mock('@/lib/use-vendor-identity', () => ({ useVendorIdentity: () => ({ data: { id: 'vendor-1', name: 'Shop', locationMode: 'fixed', mobileServiceEnabled: false } }) }));
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

describe('service eligibility', () => {
  const openEditor = async (label: string) => {
    let screen: any;
    await act(async () => { screen = create(React.createElement(VendorServicesScreen)); });
    await act(async () => { screen.root.findByProps({ accessibilityLabel: label }).props.onPress(); });
    return screen;
  };
  const chip = (screen: any, label: string) => screen.root.findAllByType(FilterChip).find((node: any) => node.props.label === label);
  const press = (screen: any, label: string) => screen.root.findAllByType(AppButton).find((node: any) => node.props.label === label).props.onPress();

  test('a new service defaults to both and saves the chosen type', async () => {
    const screen = await openEditor('Add a new service');
    expect(chip(screen, 'Shop & mobile').props.active).toBe(true);
    const name = screen.root.findAllByType(AppTextField).find((node: any) => node.props.label === 'Service name');
    await act(async () => { name.props.onChangeText('Wheel Alignment'); });
    await act(async () => { chip(screen, 'Shop only').props.onPress(); });
    await act(async () => { await press(screen, 'Add service'); });
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Wheel Alignment', bookingEligibility: 'shop' }));
    await act(async () => { screen.unmount(); });
  });

  test('editing shows the saved type and an edit changes it', async () => {
    const original = mockService.bookingEligibility;
    mockService.bookingEligibility = 'shop';
    const screen = await openEditor('Edit Oil Change');
    expect(chip(screen, 'Shop only').props.active).toBe(true);
    await act(async () => { chip(screen, 'Mobile only').props.onPress(); });
    await act(async () => { await press(screen, 'Save changes'); });
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ bookingEligibility: 'mobile' }));
    mockService.bookingEligibility = original;
    await act(async () => { screen.unmount(); });
  });

  test('warns when the vendor location rules the choice out', async () => {
    const screen = await openEditor('Add a new service');
    const warning = () => screen.root.findAllByType(Text).filter((node: any) => /can't be booked/.test(String(node.props.children)));
    expect(warning()).toHaveLength(0);
    await act(async () => { chip(screen, 'Mobile only').props.onPress(); });
    expect(warning()).toHaveLength(1);
    await act(async () => { screen.unmount(); });
  });

  test('the catalogue card labels each service with its own type', async () => {
    const original = mockService.bookingEligibility;
    mockService.bookingEligibility = 'mobile';
    let screen: any;
    await act(async () => { screen = create(React.createElement(VendorServicesScreen)); });
    const labels = screen.root.findAllByType(Text).map((node: any) => [node.props.children].flat().join(''));
    expect(labels.some((text: string) => text.includes('Mobile only'))).toBe(true);
    mockService.bookingEligibility = original;
    await act(async () => { screen.unmount(); });
  });
});
