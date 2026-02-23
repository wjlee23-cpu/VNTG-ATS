import { NextRequest, NextResponse } from 'next/server';
import { sendReminderEmailsToInterviewers } from '@/api/actions/schedules';

/**
 * 데일리 리마인드 메일 발송 API
 * 외부 cron 서비스(예: cron-job.org)에서 매일 호출
 * 
 * 보안: API 키를 사용하여 인증 (환경변수 CRON_SECRET_KEY)
 */
export async function GET(request: NextRequest) {
  try {
    // API 키 확인 (보안)
    const authHeader = request.headers.get('authorization');
    const cronSecretKey = process.env.CRON_SECRET_KEY;
    
    if (!cronSecretKey) {
      console.error('CRON_SECRET_KEY 환경변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { error: '서버 설정 오류' },
        { status: 500 }
      );
    }

    // Authorization 헤더 확인
    if (!authHeader || authHeader !== `Bearer ${cronSecretKey}`) {
      return NextResponse.json(
        { error: '인증 실패' },
        { status: 401 }
      );
    }

    // 리마인드 메일 발송 실행
    const result = await sendReminderEmailsToInterviewers();

    if (result.error) {
      console.error('리마인드 메일 발송 실패:', result.error);
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || '리마인드 메일 발송 완료',
      sentCount: result.sentCount || 0,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('리마인드 메일 발송 API 오류:', error);
    return NextResponse.json(
      { error: error.message || '알 수 없는 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST 메서드도 지원 (일부 cron 서비스에서 POST를 사용)
export async function POST(request: NextRequest) {
  return GET(request);
}
