import React from 'react';
import { Tailwind } from '@react-email/tailwind';
import { Html } from '@react-email/html';
import { Head } from '@react-email/head';
import { Font } from '@react-email/font';
import { Body } from '@react-email/body';
import { Container } from '@react-email/container';
import { Text } from '@react-email/text';
import { Section } from '@react-email/section';
import { Hr } from '@react-email/hr';
import { Heading } from '@react-email/heading';
import { Link } from '@react-email/link';

export type CandidateScheduleConfirmedEmailProps = {
  candidateName: string;
  scheduleTitle: string; // 예: "Product Manager 1차 직무 면접"
  confirmedAtLabel: string; // 예: "2026. 02. 25 (수) 오후 2:00"
  detailsLink: string;
};

export function CandidateScheduleConfirmedEmail({
  candidateName,
  scheduleTitle,
  confirmedAtLabel,
  detailsLink,
}: CandidateScheduleConfirmedEmailProps) {
  // 첨부 HTML(확정 안내 메일) 톤을 기준으로, 카드/그림자/여백을 Tailwind 클래스로 그대로 옮깁니다.
  return (
    <Tailwind>
      <Html lang="ko">
        <Head />
        <Font fontFamily="Inter" fallbackFontFamily="Arial" />
        <Body className="bg-[#F7F7F8] py-12 px-4 font-sans text-neutral-900 antialiased">
          <Container className="max-w-[600px] mx-auto bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-200 overflow-hidden text-center">
            <Section className="p-10 sm:p-14">
              <Section className="text-5xl mb-6">🎉</Section>

              <Heading as="h1" className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 mb-4">
                면접 일정이 확정되었습니다!
              </Heading>

              <Text className="text-base text-neutral-600 leading-relaxed mb-10 max-w-[400px] mx-auto">
                안녕하세요, <strong className="font-semibold text-neutral-900">{candidateName}</strong>님.
                <br />
                선택해주신 시간으로 면접 일정이 최종 확정되었습니다.
              </Text>

              <Section className="bg-neutral-900 rounded-2xl p-8 mb-10 shadow-[0_12px_24px_rgba(0,0,0,0.15)]">
                <Text className="text-xs font-bold tracking-widest text-neutral-400 uppercase mb-2">
                  {scheduleTitle}
                </Text>
                <Text className="text-xl sm:text-2xl font-bold text-white tracking-tight">{confirmedAtLabel}</Text>
              </Section>

              <Text className="text-sm text-neutral-600 leading-relaxed mb-8">
                자세한 화상 면접 접속 링크 및 사전 안내 사항은 아래 버튼을 눌러 확인해주시기 바랍니다.
                면접에서 뵙기를 기대하겠습니다.
              </Text>

              <Link
                href={detailsLink}
                className="inline-block bg-white text-neutral-900 border border-neutral-200 text-sm font-semibold px-8 py-3.5 rounded-xl shadow-sm hover:border-neutral-900 transition-colors text-decoration-none w-full sm:w-auto"
              >
                면접 상세 안내 확인하기
              </Link>

              <Hr className="border-neutral-100 my-10" />

              <Text className="text-xs text-neutral-400 font-medium">© 2026 VNTGCorp Recruitment Team.</Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

