import { createElement } from 'react';
import { FlatList, TextInput } from 'react-native';

import { AllServicesSheet } from '@/components/AllServicesSheet';
import { FilterChip } from '@/components/FilterChip';
import { Service } from '@/types/domain';

// jest-expo provides the renderer; keep this test independent of additional test libraries.
type TestNode = {
  props: Record<string, unknown>;
  findByType: (type: unknown) => TestNode;
  findAllByType: (type: unknown) => TestNode[];
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
};
// The bundled renderer has no TypeScript declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer') as {
  act: (callback: () => void) => Promise<void>;
  create: (element: ReturnType<typeof createElement>) => { root: TestNode; unmount: () => void };
};

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 48, left: 0, right: 0 }),
}));

const services: Service[] = [
  { id: 'oil', vendorId: 'shop', title: 'Oil change', category: 'oil', price: 70, durationMinutes: 30, active: true },
  { id: 'tires', vendorId: 'shop', title: 'Tire rotation', category: 'tire', price: 40, durationMinutes: 20, active: true },
];

describe('AllServicesSheet search', () => {
  it('shows clear only for populated input and restores the active category after one tap', async () => {
    let renderer: ReturnType<typeof create>;
    await act(() => {
      renderer = create(createElement(AllServicesSheet, {
        visible: true,
        onClose: jest.fn(),
        onBook: jest.fn(),
        vendorName: 'Test shop',
        bookingModes: ['shop', 'mobile'],
        services,
      }));
    });
    const root = renderer!.root;
    const clearButtons = () => root.findAll(
      (node) => node.props.accessibilityLabel === 'Clear service search' && typeof node.props.onPress === 'function',
    );
    const search = (value: string) => act(() => {
      (root.findByType(TextInput).props.onChangeText as (value: string) => void)(value);
    });
    const results = () => root.findByType(FlatList).props.data;

    expect(clearButtons()).toHaveLength(0);
    await search('oil');
    expect(clearButtons()).toHaveLength(1);
    expect(results()).toEqual([services[0]]);
    await act(() => { (clearButtons()[0].props.onPress as () => void)(); });
    expect(root.findByType(TextInput).props.value).toBe('');
    expect(clearButtons()).toHaveLength(0);
    expect(results()).toEqual(services);

    await act(() => {
      const oilChip = root.findAllByType(FilterChip).find((node) => node.props.label === 'Oil')!;
      (oilChip.props.onPress as () => void)();
    });
    await search('no match');
    expect(results()).toEqual([]);
    await act(() => { (clearButtons()[0].props.onPress as () => void)(); });
    expect(results()).toEqual([services[0]]);
    expect(clearButtons()).toHaveLength(0);

    await search(' ');
    expect(clearButtons()).toHaveLength(1);
    await search('');
    expect(clearButtons()).toHaveLength(0);
    await act(() => { renderer!.unmount(); });
  });
});
