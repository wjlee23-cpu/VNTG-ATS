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
  // ✅ 이메일 클라이언트(Gmail/Outlook/네이버메일 등)는 <style> 또는 class 기반 CSS를 일부/전부 제거할 수 있습니다.
  // 그래서 Tailwind(class) 대신 "인라인 스타일(style=...)"로 디자인을 고정합니다.
  // (사용자가 전달해준 안내메일2.html 디자인을 그대로 재현하는 목표)

  // 공통 스타일: 이메일은 CSS 지원이 제한적이므로, 최대한 단순한 속성으로 구성합니다.
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
      textAlign: 'center',
    } as React.CSSProperties,
    content: {
      padding: '40px 40px',
    } as React.CSSProperties,
    logo: {
      width: '56px',
      height: '56px',
      backgroundColor: '#171717',
      color: '#FFFFFF',
      borderRadius: '16px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      fontWeight: 800,
      letterSpacing: '-0.02em',
      margin: '0 auto 40px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
    } as React.CSSProperties,
    h1: {
      margin: '0 0 20px',
      fontSize: '28px',
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
    button: {
      display: 'inline-block',
      backgroundColor: '#171717',
      color: '#FFFFFF',
      fontSize: '14px',
      fontWeight: 700,
      padding: '16px 32px',
      borderRadius: '14px',
      textDecoration: 'none',
      boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
      width: '100%',
      maxWidth: '340px',
    } as React.CSSProperties,
    hint: {
      margin: '40px auto 32px',
      fontSize: '14px',
      color: '#A3A3A3',
      backgroundColor: '#FAFAFA',
      border: '1px solid #F5F5F5',
      borderRadius: '10px',
      display: 'inline-block',
      padding: '12px 16px',
    } as React.CSSProperties,
    hr: {
      border: 'none',
      borderTop: '1px solid #F5F5F5',
      margin: '24px 0',
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
              <Section style={styles.logo}>V</Section>

              <Heading as="h1" style={styles.h1}>
                면접 일정 선택 안내
              </Heading>

              <Text style={styles.paragraph}>
                안녕하세요, <strong style={styles.strong}>{candidateName}</strong>님.
                <br />
                VNTG에 지원해주셔서 감사합니다.
                <br />
                <br />
                <span style={styles.strong}>{positionName}</span> 포지션 1차 직무 면접 진행을 위해, 원하시는 시간을
                선택해주시기를 부탁드립니다.
              </Text>

              <Link href={selectionLink} style={styles.button}>
                가능한 시간 선택하기
              </Link>

              <Text style={styles.hint}>제안된 시간 내 선택이 어려우신 경우, 답장으로 알려주세요.</Text>

              <Hr style={styles.hr} />

              <Text style={styles.footer}>© 2026 VNTGCorp Recruitment Team.</Text>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

