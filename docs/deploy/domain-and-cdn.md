# 커스텀 도메인 & (선택) Cloud CDN 구성

## 1) Cloud Run 도메인 매핑
```bash
PROJECT_ID="your-gcp-project-id"
REGION="asia-northeast3"
SERVICE_NAME="vntg-ats"
CUSTOM_DOMAIN="app.example.com"

# 도메인 매핑
gcloud run domain-mappings create --service="$SERVICE_NAME" \
  --region="$REGION" --domain="$CUSTOM_DOMAIN"

# 필요한 DNS 레코드 확인
gcloud run domain-mappings describe --domain="$CUSTOM_DOMAIN" --region="$REGION" \
  --format="value(status.resourceRecords)"
```
위 명령으로 출력되는 레코드를 DNS 제공업체(예: Cloud DNS, Route53)에 추가합니다.

## 2) HTTPS
도메인 매핑 시 Cloud Run이 자동으로 관리형 SSL 인증서를 프로비저닝합니다.
프로비저닝에는 수 분이 걸릴 수 있습니다.

## 3) (선택) Cloud CDN + HTTPS Load Balancer
정적 자산 캐싱이나 글로벌 엣지 전송이 필요하다면 HTTPS Load Balancer와 Cloud CDN을 구성하세요.
고급 구성이므로, 아래 가이드를 참고해 단계적으로 설정하는 것을 권장합니다.

- Google 가이드: `https://cloud.google.com/run/docs/mapping-custom-domains?hl=ko`
- Cloud CDN + LB 구성: `https://cloud.google.com/cdn/docs/overview?hl=ko`

