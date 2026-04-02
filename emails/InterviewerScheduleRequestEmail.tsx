import React from 'react';
import { Tailwind } from '@react-email/tailwind';
import { Html } from '@react-email/html';
import { Head } from '@react-email/head';
import { Font } from '@react-email/font';
import { Body } from '@react-email/body';
import { Container } from '@react-email/container';
import { Text } from '@react-email/text';
import { Section } from '@react-email/section';
import { Link } from '@react-email/link';
import { Hr } from '@react-email/hr';
import { Heading } from '@react-email/heading';

type TimePill = {
  label: string; // 예: "2026. 02. 25 (수) 14:00 - 15:00"
};

export type InterviewerScheduleRequestEmailProps = {
  candidateName: string;
  interviewerName: string;
  positionName: string;
  requestTimePills: TimePill[];
  googleCalendarLink: string;
};

function GoogleCalendarIcon() {
  // 첨부 HTML의 Google 캘린더 SVG를 그대로 인라인 렌더링합니다.
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function InterviewerScheduleRequestEmail({
  candidateName,
  interviewerName,
  positionName,
  requestTimePills,
  googleCalendarLink,
}: InterviewerScheduleRequestEmailProps) {
  // 첨부 HTML을 기준으로, 이메일 레이아웃/여백/보더/섀도를 Tailwind 클래스로 그대로 재현합니다.
  return (
    <Tailwind>
      <Html lang="ko">
        <Head />
        <Font fontFamily="Inter" fallbackFontFamily="Arial" />
        <Body className="bg-[#F7F7F8] py-12 px-4 font-sans text-neutral-900 antialiased">
          <Container className="max-w-[600px] mx-auto bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-200 overflow-hidden">
            <Section className="p-10 sm:p-12">
              <Section className="w-12 h-12 bg-neutral-900 text-white rounded-xl flex items-center justify-center text-xl font-bold tracking-tighter mb-8 shadow-sm">
                V
              </Section>

              <Heading as="h1" className="text-2xl font-bold tracking-tight text-neutral-900 mb-4">
                면접 일정 확인 요청
              </Heading>

              <Text className="text-base text-neutral-600 leading-relaxed mb-8">
                안녕하세요, <strong className="font-semibold text-neutral-900">{interviewerName}</strong>님.
                <br />
                아래 후보자의 면접 진행을 위해 구글 캘린더 초대를 발송했습니다.
              </Text>

              <Section className="bg-[#FCFCFC] border border-neutral-200 rounded-xl p-6 mb-8 space-y-4">
                <Section className="grid grid-cols-[80px_1fr] gap-4 items-center">
                  <Text className="text-sm font-medium text-neutral-500">후보자</Text>
                  <Text className="text-sm font-semibold text-neutral-900">{candidateName}</Text>
                </Section>

                <Section className="grid grid-cols-[80px_1fr] gap-4 items-center">
                  <Text className="text-sm font-medium text-neutral-500">포지션</Text>
                  <Text className="text-sm font-medium text-neutral-900">{positionName}</Text>
                </Section>

                <Section className="grid grid-cols-[80px_1fr] gap-4 items-start">
                  <Text className="text-sm font-medium text-neutral-500 mt-0.5">요청 일시</Text>
                  <Section className="space-y-2">
                    {requestTimePills.map((pill, idx) => (
                      <Text
                        key={`${pill.label}-${idx}`}
                        className="inline-block text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100/50"
                      >
                        {pill.label}
                      </Text>
                    ))}
                  </Section>
                </Section>
              </Section>

              <Text className="text-sm text-neutral-600 leading-relaxed mb-8">
                해당 시간에 면접 참석이 가능하신 경우 캘린더에서 <strong>[예(Accept)]</strong>를 눌러주시고,
                불가능하신 경우 <strong>[아니요(Decline)]</strong>와 함께 사유를 메모로 남겨주시면 AI가 일정을
                재조율합니다.
              </Text>

              <Link
                href={googleCalendarLink}
                className="inline-flex items-center gap-2 bg-neutral-900 text-white text-sm font-semibold px-8 py-3.5 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:bg-neutral-800 transition-colors text-decoration-none"
              >
                <GoogleCalendarIcon />
                구글 캘린더에서 확인하기
              </Link>

              <Hr className="border-neutral-100 my-10" />

              <Text className="text-xs text-neutral-400 font-medium">
                © 2026 VNTGCorp Recruitment Team.
                <br />
                본 메일은 발신 전용이며, 시스템에 의해 자동 생성되었습니다.
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

