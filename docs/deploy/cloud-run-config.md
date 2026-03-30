# Cloud Run 구성 가이드 (환경변수/시크릿/리소스/트래픽)

아래 스크립트는 Cloud Run 서비스 설정을 업데이트합니다.
필요한 값으로 변경 후 실행하세요.

## 변수
```bash
PROJECT_ID="your-gcp-project-id"
REGION="asia-northeast3"
SERVICE_NAME="vntg-ats"
CONCURRENCY=80          # 동시 처리 요청 수 (기본 80)
MIN_INSTANCES=0         # 최소 인스턴스 (0이면 유휴 시 0으로 축소)
MAX_INSTANCES=10        # 최대 인스턴스
CPU="1"                 # vCPU
MEMORY="512Mi"          # 메모리
```

## 시크릿 → 환경변수 연결
Secret Manager의 최신 버전을 참조하도록 설정합니다.
운영에서 재현성을 위해 버전을 고정(예: :1) 하는 것을 권장합니다.
```bash
gcloud run services update "$SERVICE_NAME" \
  --region="$REGION" \
  --update-secrets=NEXT_PUBLIC_SUPABASE_URL=NEXT_PUBLIC_SUPABASE_URL:latest \
  --update-secrets=NEXT_PUBLIC_SUPABASE_ANON_KEY=NEXT_PUBLIC_SUPABASE_ANON_KEY:latest
```

## 리소스/자동 확장/동시성
```bash
gcloud run services update "$SERVICE_NAME" \
  --region="$REGION" \
  --concurrency="$CONCURRENCY" \
  --min-instances="$MIN_INSTANCES" \
  --max-instances="$MAX_INSTANCES" \
  --cpu="$CPU" \
  --memory="$MEMORY"
```

## 무중단 배포(트래픽 전환)
기본적으로 최신 리비전에 100% 트래픽을 전송합니다.
점진 전환이 필요하면 아래를 활용하세요.
```bash
# 리비전 목록 확인
gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.traffic)'

# 예: 새 리비전에 20%, 기존에 80%
gcloud run services update-traffic "$SERVICE_NAME" \
  --region="$REGION" \
  --to-revisions "REVISION_NEW=20,REVISION_OLD=80"
```

## 서비스 URL 확인
```bash
gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)'
```

