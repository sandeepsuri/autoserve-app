/**
 * Resolve the human-readable message from a Supabase Edge Function error.
 *
 * supabase-js wraps HTTP failures in a FunctionsHttpError whose `.message` is a
 * generic "non-2xx status code" string; the Edge Function's real message lives
 * in the JSON body of the Response carried on `.context`. This unwraps that body
 * and falls back to the generic message (then `fallback`) when it isn't present.
 */
export async function extractEdgeFunctionError(
  error: { message?: string; context?: unknown },
  fallback: string,
): Promise<string> {
  let message = error?.message ?? '';
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep default message */
    }
  }
  return message || fallback;
}
