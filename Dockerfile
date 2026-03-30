# Next.js 16 (App Router) Cloud Run 배포용 Dockerfile
# - 멀티 스테이지 빌드로 이미지 용량 최소화
# - standalone 빌드 산출물을 사용해 런타임 의존성 축소

# 1) Build Stage: dependencies 설치 및 Next.js 빌드
FROM node:20-slim AS builder

# 보안/재현성: corepack 활성화(선택), 패키지 매니저 캐시 억제
ENV NODE_ENV=production
WORKDIR /app

# 패키지 매니페스트만 먼저 복사하여 의존성 캐시 활용
COPY package.json package-lock.json* ./

# CI 환경 호환: peer deps 이슈 회피를 위해 --legacy-peer-deps 사용 (필요 시 제거 가능)
RUN npm ci --legacy-peer-deps

# 애플리케이션 소스 복사
COPY . .

# typescript 번역기를 먼저 설치한 뒤에 빌드 진행
RUN npm install typescript && npm run build

# 2) Runtime Stage: 경량 런타임 이미지 (distroless)
FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app

# Cloud Run은 기본적으로 8080 포트 바인딩을 기대
ENV NODE_ENV=production
ENV PORT=8080

# standalone 서버 번들 및 정적 파일만 복사
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Cloud Run용 포트 노출 (문서화 목적)
EXPOSE 8080

# Next.js standalone 서버 엔트리포인트
# .next/standalone 내부에 server.js(또는 server.cjs)가 생성됨
CMD ["server.js"]

