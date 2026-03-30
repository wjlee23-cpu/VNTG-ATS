# GCP 부트스트랩 가이드 (Cloud Run + Artifact Registry + OIDC)

아래 명령은 로컬 터미널 또는 Cloud Shell에서 1회 실행합니다.
값이 필요한 곳은 각자 프로젝트 값으로 바꿔주세요.

## 변수 설정
```bash
PROJECT_ID="ats-recruit-common"
REGION="asia-northeast3"             # 서울
GAR_LOCATION="asia-northeast3"       # Artifact Registry 리전
REPO_NAME="vntg-ats"                 # Artifact Registry 리포지토리명
SERVICE_NAME="vntg-ats"              # Cloud Run 서비스명
SA_NAME="vntg-ats-deployer"          # 배포용 서비스 계정
WIF_POOL="github-pool"
WIF_PROVIDER="github-provider"
GITHUB_ORG="wjlee23-cpu"
GITHUB_REPO="VNTG-ATS"
```

## 프로젝트 선택 및 API 활성화
```bash
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  iam.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com
```

## Artifact Registry 리포지토리 생성
```bash
gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$GAR_LOCATION" \
  --description="vntg-ats Docker images" || true
```

## 배포용 서비스 계정 생성 및 권한
```bash
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="VNTG ATS Deployer" || true

SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# 필요한 권한 부여 (최소 권한 원칙에 따라 조정 가능)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/iam.serviceAccountUser"
```

## Workload Identity Federation (GitHub OIDC)
```bash
# 풀 생성
gcloud iam workload-identity-pools create "$WIF_POOL" \
  --project="$PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Pool" || true

POOL_ID=$(gcloud iam workload-identity-pools describe "$WIF_POOL" \
  --project="$PROJECT_ID" --location="global" --format="value(name)")

# 프로바이더 생성 (GitHub)
gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$WIF_POOL" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --issuer-uri="https://token.actions.githubusercontent.com" || true

# SA에 WIF 주체에 대한 iam.workloadIdentityUser 권한 부여
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}"
```

GitHub 리포지토리 시크릿에 아래 값을 등록하세요.
```text
GCP_PROJECT_ID       = ats-recruit-common
GCP_REGION           = asia-northeast3
GCP_SERVICE_NAME     = vntg-ats
GAR_LOCATION         = asia-northeast3
GCP_WORKLOAD_IDP     = projects/XXXX/locations/global/workloadIdentityPools/github-pool/providers/github-provider
GCP_SERVICE_ACCOUNT  = vntg-ats-deployer@ats-recruit-common.iam.gserviceaccount.com
```

`GCP_WORKLOAD_IDP` 값은 다음 명령으로 확인할 수 있습니다.
```bash
gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER" \
  --project="$PROJECT_ID" --location="global" --workload-identity-pool="$WIF_POOL" \
  --format="value(name)"
```

## Secret Manager (런타임 환경변수)
Cloud Run에서 사용할 시크릿을 미리 생성해 둡니다.
```bash
gcloud secrets create NEXT_PUBLIC_SUPABASE_URL --replication-policy="automatic" || true
gcloud secrets create NEXT_PUBLIC_SUPABASE_ANON_KEY --replication-policy="automatic" || true

# 초기 버전 등록 (값 입력 프롬프트)
echo -n "https://xxx.supabase.co" | gcloud secrets versions add NEXT_PUBLIC_SUPABASE_URL --data-file=-
echo -n "anon-key" | gcloud secrets versions add NEXT_PUBLIC_SUPABASE_ANON_KEY --data-file=-
```

## Cloud Run 서비스(초기 생성, 이미지 없이도 가능)
```bash
gcloud run deploy "$SERVICE_NAME" \
  --region="$REGION" \
  --image="gcr.io/cloudrun/hello" \
  --allow-unauthenticated || true
```

이후 GitHub Actions가 이미지를 푸시하고, `deploy-cloudrun` 단계가 새 리비전을 자동으로 배포합니다.

