import { useState, useCallback } from 'react';
import { validateField } from '../lib/validation';

export function useForm<T extends Record<string, string>>(
  initial: T,
  schema: { [K in keyof T]: Array<(value: string) => string> }
) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const setValue = useCallback(
    (key: keyof T, value: string) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      if (touched[key]) {
        setErrors((prev) => ({ ...prev, [key]: validateField(value, schema[key]) }));
      }
    },
    [schema, touched]
  );

  const blur = useCallback(
    (key: keyof T) => {
      setTouched((prev) => ({ ...prev, [key]: true }));
      setErrors((prev) => ({ ...prev, [key]: validateField(values[key], schema[key]) }));
    },
    [schema, values]
  );

  const isValid = (Object.keys(schema) as Array<keyof T>).every(
    (key) => !validateField(values[key], schema[key])
  );

  return { values, errors, touched, setValue, blur, isValid };
}
