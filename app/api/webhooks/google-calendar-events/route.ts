import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkInterviewerResponses } from '@/api/actions/schedules';

/**
 * Google Calendar Push Notification webhook
 * - headers에서 watch 정보를 찾아 scheduleId를 역추적
 * - 이후 checkInterviewerResponses를 자동 실행
 */
export async function POST(request: NextRequest) {
  try {
    const resourceState = request.headers.get('x-goog-resource-state');
    const channelId = request.headers.get('x-goog-channel-id');
    const channelToken = request.headers.get('x-goog-channel-token');

    // watch 등록 시점에 오는 sync 알림은 불필요하므로 무시
    if (resourceState === 'sync') {
      return NextResponse.json({ success: true, ignored: true, reason: 'sync' }, { status: 200 });
    }

    // token이 없는 경우 channelId로만 매칭 시도 (가능하면 token 우선)
    if (!channelToken && !channelId) {
      return NextResponse.json(
        { success: false, error: '필수 헤더가 누락되었습니다.' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const { data: optionRow, error: optionError } = channelToken
      ? await supabase
          .from('schedule_options')
          .select('id, schedule_id')
          .eq('watch_token', channelToken)
          .maybeSingle()
      : await supabase
          .from('schedule_options')
          .select('id, schedule_id')
          .eq('watch_channel_id', channelId || '')
          .maybeSingle();

    if (optionError) {
      console.error('[GoogleWebhook] schedule_options 조회 실패:', optionError);
      return NextResponse.json({ success: false, error: 'DB 조회 실패' }, { status: 500 });
    }

    if (!optionRow) {
      return NextResponse.json({ success: false, error: 'watch 매핑을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 웹훅 호출 경로에서는 세션이 없으므로 bypassAuth 옵션으로 처리합니다.
    await checkInterviewerResponses(optionRow.schedule_id, { bypassAuth: true });

    return NextResponse.json({ success: true, scheduleId: optionRow.schedule_id }, { status: 200 });
  } catch (error) {
    console.error('[GoogleWebhook] 처리 실패:', error);
    return NextResponse.json({ success: false, error: '처리 실패' }, { status: 500 });
  }
}

// 일부 구성이 GET으로 호출될 수 있어 GET도 동일하게 처리
export async function GET(request: NextRequest) {
  return POST(request);
}

