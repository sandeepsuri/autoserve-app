import { extractEdgeFunctionError } from '@/lib/edge-functions';

describe('extractEdgeFunctionError', () => {
  it('returns the Edge Function JSON body error when present', async () => {
    const error = {
      message: 'Edge Function returned a non-2xx status code',
      context: { json: async () => ({ error: 'Active vendor account required' }) },
    };
    expect(await extractEdgeFunctionError(error, 'fallback')).toBe('Active vendor account required');
  });

  it('falls back to error.message when the body has no error field', async () => {
    const error = {
      message: 'network down',
      context: { json: async () => ({ received: true }) },
    };
    expect(await extractEdgeFunctionError(error, 'fallback')).toBe('network down');
  });

  it('keeps the message when the response body is not valid JSON', async () => {
    const error = {
      message: 'boom',
      context: {
        json: async () => {
          throw new Error('invalid json');
        },
      },
    };
    expect(await extractEdgeFunctionError(error, 'fallback')).toBe('boom');
  });

  it('uses the fallback when there is no message and no context', async () => {
    expect(await extractEdgeFunctionError({}, 'could not start')).toBe('could not start');
  });

  it('uses the fallback when message is empty and body has no error', async () => {
    const error = { message: '', context: { json: async () => ({}) } };
    expect(await extractEdgeFunctionError(error, 'could not start')).toBe('could not start');
  });
});
