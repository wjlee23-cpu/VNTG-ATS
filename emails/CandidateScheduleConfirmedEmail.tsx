import React from 'react';
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
  // ✅ 이메일 클라이언트는 class 기반 CSS(<style> + class)를 제거/축약할 수 있습니다.
  // 그래서 Tailwind 대신 인라인 스타일로 "확정 안내 메일(안내메일4.html)" 디자인을 고정합니다.

  const styles = {
    body: {
      margin: 0,
      padding: 0,
      backgroundColor: '#F7F7F8',
      fontFamily: "Inter, Arial, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
      color: '#171717',
      textAlign: 'center',
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
      textAlign: 'center',
    } as React.CSSProperties,
    content: {
      padding: '40px 40px',
    } as React.CSSProperties,
    emoji: {
      fontSize: '48px',
      margin: '0 0 24px',
      lineHeight: 1,
    } as React.CSSProperties,
    h1: {
      margin: '0 0 16px',
      fontSize: '30px',
      fontWeight: 800,
      letterSpacing: '-0.02em',
      lineHeight: 1.2,
      color: '#171717',
    } as React.CSSProperties,
    paragraph: {
      margin: '0 auto 40px',
      fontSize: '16px',
      lineHeight: 1.6,
      color: '#525252',
      maxWidth: '400px',
    } as React.CSSProperties,
    strong: {
      fontWeight: 700,
      color: '#171717',
    } as React.CSSProperties,
    highlightCard: {
      backgroundColor: '#171717',
      borderRadius: '16px',
      padding: '32px 24px',
      margin: '0 auto 40px',
      boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
    } as React.CSSProperties,
    titleSmall: {
      margin: '0 0 8px',
      fontSize: '12px',
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      color: '#A3A3A3',
    } as React.CSSProperties,
    timeBig: {
      margin: 0,
      fontSize: '22px',
      fontWeight: 800,
      letterSpacing: '-0.01em',
      color: '#FFFFFF',
    } as React.CSSProperties,
    desc: {
      margin: '0 0 32px',
      fontSize: '14px',
      lineHeight: 1.6,
      color: '#525252',
    } as React.CSSProperties,
    button: {
      display: 'inline-block',
      backgroundColor: '#FFFFFF',
      color: '#171717',
      border: '1px solid #E5E5E5',
      fontSize: '14px',
      fontWeight: 700,
      padding: '14px 32px',
      borderRadius: '14px',
      textDecoration: 'none',
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      width: '100%',
      maxWidth: '340px',
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
              <Section style={styles.emoji}>🎉</Section>

              <Heading as="h1" style={styles.h1}>
                면접 일정이 확정되었습니다!
              </Heading>

              <Text style={styles.paragraph}>
                안녕하세요, <strong style={styles.strong}>{candidateName}</strong>님.
                <br />
                선택해주신 시간으로 면접 일정이 최종 확정되었습니다.
              </Text>

              <Section style={styles.highlightCard}>
                <Text style={styles.titleSmall}>{scheduleTitle}</Text>
                <Text style={styles.timeBig}>{confirmedAtLabel}</Text>
              </Section>

              <Text style={styles.desc}>
                자세한 화상 면접 접속 링크 및 사전 안내 사항은 아래 버튼을 눌러 확인해주시기 바랍니다. 면접에서
                뵙기를 기대하겠습니다.
              </Text>

              <Link href={detailsLink} style={styles.button}>
                면접 상세 안내 확인하기
              </Link>

              <Hr style={styles.hr} />

              <Text style={styles.footer}>© 2026 VNTGCorp Recruitment Team.</Text>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

