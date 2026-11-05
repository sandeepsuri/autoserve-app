import React from 'react';
import { TextInput } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { SearchablePicker } from '@/components/SearchablePicker';

const { act, create } = jest.requireActual('react-test-renderer');
Object.assign(global, { IS_REACT_ACT_ENVIRONMENT: true });

it.each(['Make', 'Model', 'Year'])('%s shows loading and failure, retries, and selects a loaded option', async (label) => {
  const onRetry = jest.fn();
  const onChange = jest.fn();
  const props = { label, value: '', options: [], onChange, onRetry };
  let tree: ReturnType<typeof create>;
  await act(async () => { tree = create(React.createElement(SearchablePicker, { ...props, isLoading: true })); });
  expect(tree.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityLabel).toBe(`Loading ${label.toLowerCase()}`);

  await act(async () => { tree.update(React.createElement(SearchablePicker, { ...props, loadError: 'Service unavailable. Please try again.' })); });
  expect(tree.root.findByProps({ children: 'Service unavailable. Please try again.' })).toBeTruthy();
  await act(async () => { tree.root.findByType(AppButton).props.onPress(); });
  expect(onRetry).toHaveBeenCalledTimes(1);

  await act(async () => { tree.update(React.createElement(SearchablePicker, { ...props, options: [{ label: 'Example' }] })); });
  await act(async () => { tree.root.findByType(TextInput).props.onFocus(); });
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Select Example' }).props.onPress(); });
  expect(onChange).toHaveBeenCalledWith('Example');
  await act(async () => { tree.unmount(); });
});

it('keeps dependent steps disabled without showing loading or retry', async () => {
  let tree: ReturnType<typeof create>;
  await act(async () => {
    tree = create(React.createElement(SearchablePicker, {
      label: 'Model', value: '', options: [], onChange: jest.fn(), disabled: true,
      disabledHelperText: 'Pick a make first', isLoading: true,
    }));
  });
  expect(tree.root.findByType(TextInput).props.editable).toBe(false);
  expect(tree.root.findAllByProps({ accessibilityRole: 'progressbar' })).toHaveLength(0);
  expect(tree.root.findAllByType(AppButton)).toHaveLength(0);
  await act(async () => { tree.unmount(); });
});
