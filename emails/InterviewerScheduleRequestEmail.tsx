import React from 'react';
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
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      style={{
        width: 16,
        height: 16,
        display: 'block',
      }}
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
  // ✅ 이메일 클라이언트는 class 기반 CSS를 제거/축약할 수 있습니다.
  // 그래서 Tailwind 대신 인라인 스타일로 "면접 일정 확인 요청(안내메일1.html)" 디자인을 고정합니다.

  const styles = {
    body: {
      margin: 0,
      padding: 0,
      backgroundColor: '#F7F7F8',
      fontFamily: "Inter, Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
      color: '#171717',
    } as React.CSSProperties,
    outer: {
      padding: '48px 16px',
    } as React.CSSProperties,
    card: {
      maxWidth: '600px',
      margin: '0 auto',
      backgroundColor: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid #E5E5E5',
      overflow: 'hidden',
      boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
      textAlign: 'left' as const,
    } as React.CSSProperties,
    content: {
      padding: '40px 40px',
    } as React.CSSProperties,
    logo: {
      width: '48px',
      height: '48px',
      backgroundColor: '#171717',
      color: '#FFFFFF',
      borderRadius: '12px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
      fontWeight: 800,
      letterSpacing: '-0.02em',
      margin: '0 0 32px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
    } as React.CSSProperties,
    h1: {
      margin: '0 0 16px',
      fontSize: '24px',
      fontWeight: 800,
      letterSpacing: '-0.02em',
      lineHeight: 1.2,
      color: '#171717',
    } as React.CSSProperties,
    paragraph: {
      margin: '0 0 32px',
      fontSize: '16px',
      lineHeight: 1.6,
      color: '#525252',
    } as React.CSSProperties,
    strong: {
      fontWeight: 700,
      color: '#171717',
    } as React.CSSProperties,
    infoBox: {
      backgroundColor: '#FCFCFC',
      border: '1px solid #E5E5E5',
      borderRadius: '14px',
      padding: '24px',
      margin: '0 0 32px',
    } as React.CSSProperties,
    row: {
      display: 'block',
      margin: '0 0 12px',
    } as React.CSSProperties,
    label: {
      display: 'inline-block',
      width: '80px',
      fontSize: '13px',
      fontWeight: 600,
      color: '#737373',
      verticalAlign: 'top',
    } as React.CSSProperties,
    value: {
      display: 'inline-block',
      fontSize: '13px',
      fontWeight: 700,
      color: '#171717',
      verticalAlign: 'top',
      maxWidth: '460px',
    } as React.CSSProperties,
    valueNormal: {
      display: 'inline-block',
      fontSize: '13px',
      fontWeight: 600,
      color: '#171717',
      verticalAlign: 'top',
      maxWidth: '460px',
    } as React.CSSProperties,
    pillWrap: {
      display: 'inline-block',
      verticalAlign: 'top',
      maxWidth: '460px',
    } as React.CSSProperties,
    pill: {
      display: 'inline-block',
      fontSize: '13px',
      fontWeight: 800,
      color: '#2563EB',
      backgroundColor: '#EFF6FF',
      padding: '8px 12px',
      borderRadius: '10px',
      border: '1px solid rgba(191, 219, 254, 0.7)',
      margin: '0 8px 8px 0',
    } as React.CSSProperties,
    desc: {
      margin: '0 0 32px',
      fontSize: '14px',
      lineHeight: 1.6,
      color: '#525252',
    } as React.CSSProperties,
    button: {
      display: 'inline-block',
      backgroundColor: '#171717',
      color: '#FFFFFF',
      fontSize: '14px',
      fontWeight: 700,
      padding: '14px 28px',
      borderRadius: '14px',
      textDecoration: 'none',
      boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
    } as React.CSSProperties,
    buttonInner: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
    } as React.CSSProperties,
    hr: {
      border: 'none',
      borderTop: '1px solid #F5F5F5',
      margin: '40px 0',
    } as React.CSSProperties,
    footer: {
      margin: 0,
      fontSize: '12px',
      color: '#A3A3A3',
      fontWeight: 600,
      lineHeight: 1.6,
    } as React.CSSProperties,
  };

  return (
    <Html lang="ko">
      <Head />
      <Font fontFamily="Inter" fallbackFontFamily="Arial" />
      <Body style={styles.body}>
        <Section style={styles.outer}>
          <Container style={styles.card}>
            <Section style={styles.content}>
              <Section style={styles.logo}>V</Section>

              <Heading as="h1" style={styles.h1}>
                면접 일정 확인 요청
              </Heading>

              <Text style={styles.paragraph}>
                안녕하세요, <strong style={styles.strong}>{interviewerName}</strong>님.
                <br />
                아래 후보자의 면접 진행을 위해 구글 캘린더 초대를 발송했습니다.
              </Text>

              <Section style={styles.infoBox}>
                <Section style={styles.row}>
                  <Text style={styles.label}>후보자</Text>
                  <Text style={styles.value}>{candidateName}</Text>
                </Section>

                <Section style={styles.row}>
                  <Text style={styles.label}>포지션</Text>
                  <Text style={styles.valueNormal}>{positionName}</Text>
                </Section>

                <Section style={styles.row}>
                  <Text style={styles.label}>요청 일시</Text>
                  <Section style={styles.pillWrap}>
                    {requestTimePills.map((pill, idx) => (
                      <Text key={`${pill.label}-${idx}`} style={styles.pill}>
                        {pill.label}
                      </Text>
                    ))}
                  </Section>
                </Section>
              </Section>

              <Text style={styles.desc}>
                해당 시간에 면접 참석이 가능하신 경우 캘린더에서 <strong style={styles.strong}>[예(Accept)]</strong>
                를 눌러주시고, 불가능하신 경우 <strong style={styles.strong}>[아니요(Decline)]</strong>와 함께 사유를
                메모로 남겨주시면 AI가 일정을 재조율합니다.
              </Text>

              <Link href={googleCalendarLink} style={styles.button}>
                <span style={styles.buttonInner}>
                  <GoogleCalendarIcon />
                  구글 캘린더에서 확인하기
                </span>
              </Link>

              <Hr style={styles.hr} />

              <Text style={styles.footer}>
                © 2026 VNTGCorp Recruitment Team.
                <br />
                본 메일은 발신 전용이며, 시스템에 의해 자동 생성되었습니다.
              </Text>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

