/**
 * Runtime validation and sanitization utilities
 * Ensures payload data integrity and prevents unhandled runtime exceptions.
 */

export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors: string[];
}

export function validateNumeric(
  value: any,
  fieldName: string,
  options: { min?: number; max?: number; allowZero?: boolean } = {}
): { isValid: boolean; value: number; error?: string } {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, value: 0, error: `${fieldName} debe ser un número válido.` };
  }

  if (options.allowZero === false && num === 0) {
    return { isValid: false, value: num, error: `${fieldName} no puede ser cero.` };
  }

  if (options.min !== undefined && num < options.min) {
    return { isValid: false, value: num, error: `${fieldName} no puede ser menor a ${options.min}.` };
  }

  if (options.max !== undefined && num > options.max) {
    return { isValid: false, value: num, error: `${fieldName} no puede ser mayor a ${options.max}.` };
  }

  return { isValid: true, value: num };
}

export function validateString(
  value: any,
  fieldName: string,
  options: { minLength?: number; maxLength?: number; required?: boolean } = {}
): { isValid: boolean; value: string; error?: string } {
  const str = typeof value === 'string' ? value.trim() : (value !== null && value !== undefined ? String(value).trim() : '');
  
  if (options.required && str.length === 0) {
    return { isValid: false, value: '', error: `${fieldName} es un campo requerido.` };
  }

  if (options.minLength !== undefined && str.length < options.minLength) {
    return { isValid: false, value: str, error: `${fieldName} debe tener al menos ${options.minLength} caracteres.` };
  }

  if (options.maxLength !== undefined && str.length > options.maxLength) {
    return { isValid: false, value: str, error: `${fieldName} no puede superar los ${options.maxLength} caracteres.` };
  }

  return { isValid: true, value: str };
}

export function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // strip potential angle brackets
    .trim();
}
