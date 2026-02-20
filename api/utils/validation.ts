/**
 * 입력 검증 유틸리티
 * Server Actions에서 사용하는 공통 검증 로직
 */

import { ValidationError } from './errors';

/**
 * 문자열이 비어있지 않은지 확인합니다.
 */
export function validateRequired(value: unknown, fieldName: string): string {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName}은(는) 필수입니다.`);
  }
  return value.trim();
}

/**
 * 이메일 형식을 검증합니다.
 */
export function validateEmail(email: string): string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('올바른 이메일 형식이 아닙니다.');
  }
  return email;
}

/**
 * 전화번호 형식을 검증합니다. (한국 형식: 010-1234-5678)
 */
export function validatePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  const phoneRegex = /^010-\d{4}-\d{4}$/;
  if (!phoneRegex.test(phone)) {
    throw new ValidationError('올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)');
  }
  return phone;
}

/**
 * UUID 형식을 검증합니다.
 */
export function validateUUID(id: string, fieldName: string = 'ID'): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new ValidationError(`${fieldName} 형식이 올바르지 않습니다.`);
  }
  return id;
}

/**
 * 숫자 범위를 검증합니다.
 */
export function validateNumberRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): number {
  if (value < min || value > max) {
    throw new ValidationError(`${fieldName}은(는) ${min}과 ${max} 사이의 값이어야 합니다.`);
  }
  return value;
}

/**
 * 날짜가 미래인지 확인합니다.
 */
export function validateFutureDate(date: Date, fieldName: string): Date {
  const now = new Date();
  if (date <= now) {
    throw new ValidationError(`${fieldName}은(는) 미래 날짜여야 합니다.`);
  }
  return date;
}

/**
 * 배열이 비어있지 않은지 확인합니다.
 */
export function validateNonEmptyArray<T>(
  array: T[],
  fieldName: string
): T[] {
  if (!Array.isArray(array) || array.length === 0) {
    throw new ValidationError(`${fieldName}은(는) 최소 1개 이상이어야 합니다.`);
  }
  return array;
}
