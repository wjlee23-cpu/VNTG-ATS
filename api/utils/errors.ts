/**
 * 에러 처리 유틸리티
 * 일관된 에러 응답 형식을 제공합니다.
 */

/**
 * 애플리케이션 커스텀 에러 클래스
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * 인증 관련 에러
 */
export class AuthenticationError extends AppError {
  constructor(message: string = '인증이 필요합니다.') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * 권한 관련 에러
 */
export class AuthorizationError extends AppError {
  constructor(message: string = '접근 권한이 없습니다.') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

/**
 * 리소스를 찾을 수 없는 에러
 */
export class NotFoundError extends AppError {
  constructor(resource: string = '리소스') {
    super(`${resource}를 찾을 수 없습니다.`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * 입력 검증 에러
 */
export class ValidationError extends AppError {
  constructor(message: string = '입력값이 올바르지 않습니다.') {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

/**
 * 에러를 안전하게 처리하고 사용자 친화적인 메시지를 반환합니다.
 * @param error 발생한 에러
 * @returns 사용자에게 표시할 에러 메시지
 */
export function handleError(error: unknown): string {
  // AppError 인스턴스인 경우
  if (error instanceof AppError) {
    return error.message;
  }

  // 일반 Error 인스턴스인 경우
  if (error instanceof Error) {
    // Supabase 에러인 경우 처리
    if (error.message.includes('duplicate key')) {
      return '이미 존재하는 데이터입니다.';
    }
    if (error.message.includes('foreign key')) {
      return '관련된 데이터를 찾을 수 없습니다.';
    }
    if (error.message.includes('violates row-level security')) {
      return '접근 권한이 없습니다.';
    }
    
    return error.message;
  }

  // 알 수 없는 에러
  return '예상치 못한 오류가 발생했습니다.';
}

/**
 * Server Action에서 사용하는 에러 처리 래퍼
 * 에러를 catch하여 사용자 친화적인 메시지로 변환합니다.
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>
): Promise<{ data?: T; error?: string }> {
  try {
    const data = await fn();
    return { data };
  } catch (error) {
    return { error: handleError(error) };
  }
}
