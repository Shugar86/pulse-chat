export const validators = {
  required: (value: string) => (value.trim() ? '' : 'required'),
  email: (value: string) => (/^\S+@\S+\.\S+$/.test(value) ? '' : 'invalidEmail'),
  minLength: (min: number) => (value: string) => (value.length >= min ? '' : `minLength:${min}`),
};

export function validateField(value: string, rules: Array<(value: string) => string>): string {
  for (const rule of rules) {
    const error = rule(value);
    if (error) return error;
  }
  return '';
}

export function parseMinLengthError(error: string): { key: string; params?: { min: number } } {
  if (error.startsWith('minLength:')) {
    const min = parseInt(error.split(':')[1], 10);
    return { key: 'minLength', params: { min } };
  }
  return { key: error };
}
