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

export type CandidateScheduleSelectionRequestEmailProps = {
  candidateName: string;
  positionName: string;
  selectionLink: string;
};

export function CandidateScheduleSelectionRequestEmail({
  candidateName,
  positionName,
  selectionLink,
}: CandidateScheduleSelectionRequestEmailProps) {
  // 첨부 HTML을 기준으로, 카드 중심/타이포/보더/섀도를 그대로 재현합니다.
  return (
    <Tailwind>
      <Html lang="ko">
        <Head />
        <Font fontFamily="Inter" fallbackFontFamily="Arial" />
        <Body className="bg-[#F7F7F8] py-12 px-4 font-sans text-neutral-900 antialiased">
          <Container className="max-w-[600px] mx-auto bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-200 overflow-hidden text-center">
            <Section className="p-10 sm:p-14">
              <Section className="w-14 h-14 bg-neutral-900 text-white rounded-2xl flex items-center justify-center text-2xl font-bold tracking-tighter mx-auto mb-10 shadow-sm">
                V
              </Section>

              <Heading as="h1" className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 mb-5">
                면접 일정 선택 안내
              </Heading>

              <Text className="text-base text-neutral-600 leading-relaxed mb-10 max-w-[400px] mx-auto">
                안녕하세요, <strong className="font-semibold text-neutral-900">{candidateName}</strong>님.
                <br />
                VNTG에 지원해주셔서 감사합니다.
                <br />
                <br />
                <span className="font-medium text-neutral-900">{positionName}</span> 포지션 1차 직무 면접
                진행을 위해, 원하시는 시간을 선택해주시기를 부탁드립니다.
              </Text>

              <Link
                href={selectionLink}
                className="inline-block bg-neutral-900 text-white text-sm font-semibold px-8 py-4 rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-neutral-800 transition-colors text-decoration-none w-full sm:w-auto"
              >
                가능한 시간 선택하기
              </Link>

              <Text className="text-sm text-neutral-400 mt-10 mb-8 bg-neutral-50 py-3 px-4 rounded-lg inline-block border border-neutral-100">
                제안된 시간 내 선택이 어려우신 경우, 답장으로 알려주세요.
              </Text>

              <Hr className="border-neutral-100 my-8" />

              <Text className="text-xs text-neutral-400 font-medium">
                © 2026 VNTGCorp Recruitment Team.
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

