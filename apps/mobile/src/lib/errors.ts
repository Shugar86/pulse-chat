export interface ApiFieldError {
  field: string;
  message: string;
}

export function getFieldErrors(error: any): ApiFieldError[] {
  if (error?.response?.data?.fields) return error.response.data.fields as ApiFieldError[];
  return [];
}

export function getGeneralError(error: any): string {
  return error?.response?.data?.error || error?.message || 'genericError';
}

export function getFieldErrorMap(error: any): Record<string, string> {
  const fields = getFieldErrors(error);
  return Object.fromEntries(fields.map((f) => [f.field, f.message]));
}
