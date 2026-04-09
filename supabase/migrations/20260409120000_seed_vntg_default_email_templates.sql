-- VNTG 기본 이메일 템플릿 10종 (UI에서 생성한 것과 동일한 행)
-- 조직마다 admin/recruiter 사용자 1명을 created_by로 사용합니다.
-- 이미 동일 이름 템플릿이 있으면 삽입하지 않습니다.

INSERT INTO public.email_templates (organization_id, name, subject, body, created_by)
SELECT
  o.id,
  v.name,
  v.subject,
  v.body,
  u.id
FROM public.organizations o
INNER JOIN LATERAL (
  SELECT id
  FROM public.users
  WHERE organization_id = o.id
    AND role IN ('admin', 'recruiter')
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1
) u ON true
CROSS JOIN (
  VALUES
    ('면접 일정 확정 (서울)', '[VNTG] 면접 일정 확정 안내 (서울)', $vntg_email_body_0$
안녕하세요, {{candidate.name}}님

아래와 같이 면접 일정이 확정되었습니다.

포지션	{{job.title}}
면접장소	{{interview.location}}
면접일자/시간	{{interview.dateTimeText}}
음료선택	{{interview.beverageType}} + {{interview.beverageTemperature}}
[방문 예약 방법]
방문객 예약 시스템을 통해 면접일 방문예약을 신청합니다.
(담당자: 브이엔티지 박하윤 님 / 방문목적: 면접 / 방문시간: 오후 9-18시로 선택)
예약이 승인되면, 카카오톡으로 승인 알림과 QR코드가 발송됩니다.
면접 당일 세아타워 1층에서 QR 태그 후 보안 게이트를 출입합니다.
좌측 3~5호 엘리베이터 탑승 후 층수 버튼 위쪽에 있는 "리더기"에 QR 태그 후 7층 버튼을 누릅니다.
해당 층 하차 후 [010-9795-8690]으로 전화주시기 바랍니다.
[주차 안내]

세아타워 지하 주차장 4층 차단기 안쪽 초록색 기둥 구역에 주차 부탁드립니다.

(차단기 밖 주황색 기둥 구역에 주차하실 경우 주차 지원이 불가하오니 참고바랍니다.)$vntg_email_body_0$),
    ('면접 일정 확정 (포항)', '[VNTG] 면접 일정 확정 안내 (포항)', $vntg_email_body_1$
안녕하세요, {{candidate.name}}님

아래와 같이 면접 일정이 확정되었습니다.

포지션	{{job.title}}
면접장소	{{interview.location}}
면접일자/시간	{{interview.dateTimeText}}

면접 당일 면접장소로 도착하신 후, [000-0000-0000]으로 전화주시기 바랍니다.$vntg_email_body_1$),
    ('면접 일정 확정 (창원)', '[VNTG] 면접 일정 확정 안내 (창원)', $vntg_email_body_2$
안녕하세요, {{candidate.name}}님

아래와 같이 면접 일정이 확정되었습니다.

포지션	{{job.title}}
면접장소	{{interview.location}}
면접일자/시간	{{interview.dateTimeText}}

면접 당일 면접장소로 도착하신 후, [010-8582-5074]으로 전화주시기 바랍니다.$vntg_email_body_2$),
    ('면접 일정 확정 (군산)', '[VNTG] 면접 일정 확정 안내 (군산)', $vntg_email_body_3$
안녕하세요, {{candidate.name}}님

아래와 같이 면접 일정이 확정되었습니다.

포지션	{{job.title}}
면접장소	{{interview.location}}
면접일자/시간	{{interview.dateTimeText}}

면접 당일 면접장소로 도착하신 후, [000-0000-0000]으로 전화주시기 바랍니다.$vntg_email_body_3$),
    ('서류합격 및 1차면접 안내 (서울)', '[VNTG] 서류 합격 및 1차 면접 안내 (서울)', $vntg_email_body_4$
Congratulations!

안녕하세요 {{candidate.name}} 님, VNTG 채용팀입니다.

{{job.title}} 포지션에 관심을 갖고 지원해 주셔서 진심으로 감사드립니다.

서류 전형에 합격하신 것을 축하드리며, 아래와 같이 1차 면접을 진행하고자 연락드립니다. 아래 링크를 통해 일정을 확인하신 후 당일 드실 음료를 내일 오전까지 선택해 주시면 감사하겠습니다.

면접내용 (실무면접)
10분(EX실): 면접관 소개, 취미, 지원동기 및 경로, 회사 이해, 직무 이해
30분(면접부서): 직무 소개, 이력서 검증, 면접 평가 항목 관련 Q&A
10분(EX실): 후보자 질문 및 마무리 인사



면접 관련하여 문의사항 있으시면 언제든지 본 메일로 연락 부탁드립니다.$vntg_email_body_4$),
    ('서류합격 및 1차면접 안내 (지방)', '[VNTG] 서류 합격 및 1차 면접 안내 (지방)', $vntg_email_body_5$
Congratulations!

안녕하세요 {{candidate.name}} 님, VNTG 채용팀입니다.

{{job.title}} 포지션에 관심을 갖고 지원해 주셔서 진심으로 감사드립니다.

서류 전형에 합격하신 것을 축하드리며, 아래와 같이 1차 면접을 진행하고자 연락드립니다. 아래 링크를 통해 참석 가능한 일정을 내일 오전까지 선택해 주시면 감사하겠습니다.

면접내용 (실무면접)
10분(EX실): 면접관 소개, 취미, 지원동기 및 경로, 회사 이해, 직무 이해
30분(면접부서): 직무 소개, 이력서 검증, 면접 평가 항목 관련 Q&A
10분(EX실): 후보자 질문 및 마무리 인사



면접 관련하여 문의사항 있으시면 언제든지 본 메일로 연락 부탁드립니다.$vntg_email_body_5$),
    ('1차합격 및 2차면접 안내 (서울)', '[VNTG] 1차 합격 및 2차 면접 안내 (서울)', $vntg_email_body_6$
Congratulations!

안녕하세요 {{candidate.name}} 님, VNTG 채용팀입니다.

{{job.title}} 포지션에 관심을 갖고 지원해 주셔서 진심으로 감사드립니다.

1차 면접 전형에 합격하신 것을 축하드리며, 아래와 같이 2차 면접을 진행하고자 연락드립니다. 아래 링크를 통해 일정을 확인하신 후 당일 드실 음료를 내일 오전까지 선택해 주시면 감사하겠습니다.

면접내용 (Culture-FIT 면접)
10분(EX실): 면접관 소개, 취미, 지원동기 및 경로, 회사 이해, 직무 이해
30분(면접부서): Culture fit (채용부서의 인원, 분위기, 조직지향점 등)
10분(EX실): 후보자 질문 및 마무리 인사



☑️ 2차 면접과 함께 레퍼런스 체크(평판 조회)를 진행합니다.

평판 조회는 지정평판 3명으로 요청드리고 있습니다.

3명 중 1명은 인사권자로 지정 부탁드리며, 가능하다면 각각 다른 회사에서 근무하신 분으로 지정 요청드립니다.

추천인 정보를 아래 설문으로 입력해주세요.

=> 추천인 정보 입력하기

추천인 정보는 메일 수신 후 다음날까지 부탁드립니다.

2차 면접과 레퍼런스 체크 결과를 종합하여 최종 결과를 안내드립니다.

☑️ 2차 면접 통과 시 인사총괄 미팅이 진행됩니다.

2차 면접일 전날까지, 아래 링크에서 가장 최근 직장의 1) 최근 6개월간 각 월별 급여명세서, 2) 전년도 원천징수영수증을 제출해 주세요.

서류제출 링크(클릭)

면접 관련하여 문의사항 있으시면 언제든지 본 메일로 연락 부탁드립니다.$vntg_email_body_6$),
    ('1차합격 및 2차면접 안내 (지방)', '[VNTG] 1차 합격 및 인사총괄 면접 안내 (지방)', $vntg_email_body_7$
Congratulations!

안녕하세요 {{candidate.name}} 님, VNTG 채용팀입니다.

{{job.title}} 포지션에 관심을 갖고 지원해 주셔서 진심으로 감사드립니다.

1차 면접 전형에 합격하신 것을 축하드리며, 아래와 같이 인사총괄 면접을 안내해 드립니다.

서류 준비 목록:

인사 총괄 면접일 전날까지, 아래 링크에서 가장 최근 직장의 1) 최근 6개월간 각 월별 급여명세서, 2) 전년도 원천징수영수증을 제출해 주세요.

서류제출 링크(클릭)
인사총괄 면접:
일자: {{interview.dateTimeText}}
시작 시각 5분 전까지 영상 통화 링크로 접속 부탁드립니다.



면접 관련하여 문의사항 있으시면 언제든지 본 메일로 연락 부탁드립니다.$vntg_email_body_7$),
    ('2차합격 및 3차면접 안내', '[VNTG] 2차 합격 및 3차(대표이사) 면접 안내', $vntg_email_body_8$
Congratulations!

안녕하세요 {{candidate.name}} 님, VNTG 채용팀입니다.

{{job.title}} 포지션에 관심을 갖고 지원해 주셔서 진심으로 감사드립니다.

3차 면접 전형에 합격하신 것을 축하드리며, 아래와 같이 대표이사 면접을 안내해 드립니다.

면접내용 (대표이사 면접)
10분(대표이사/CEO): 면접관 소개, 회사이해
30분(대표이사/CEO): 조직지향점과 비전
30분(인사총괄면접): 제출한 서류 기반으로 최근직장의 처우관련 확인
인사총괄 면접준비
일자: {{interview.dateTimeText}}
시작 시간 5분전까지 영상 통화 링크로 접속 부탁드립니다.


면접 관련하여 문의사항 있으시면 언제든지 본 메일로 연락 부탁드립니다.$vntg_email_body_8$),
    ('최종 합격 안내', '[VNTG] 최종 합격을 축하드립니다', $vntg_email_body_9$
Congratulations!

안녕하세요 {{candidate.name}} 님,

{{job.title}} 채용전형의 최종합격을 축하드립니다!

모든 채용 전형에 항상 적극적으로 임해주셔서 감사합니다.

저희 VNTG는 {{candidate.name}} 님을 VNTGian으로 모실 수 있게 되어 대단히 기쁘게 생각합니다.



출근 및 입사 전 준비사항에 대한 안내메일이 발송 될 예정입니다.

메일을 확인하신 후 궁금한 사항은 언제든 편하게 연락주세요.



다시 한번 최종 합격을 축하드립니다.

감사합니다.$vntg_email_body_9$)
) AS v(name, subject, body)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.email_templates et
  WHERE et.organization_id = o.id
    AND et.name = v.name
);
