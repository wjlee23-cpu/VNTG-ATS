import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud Run에 최적화된 standalone 빌드 산출물을 생성
  // Dockerfile이 이 산출물을 사용하여 경량 런타임 이미지를 구성합니다.
  output: "standalone",
  // 필요 시 서버 액션 본문 크기 등 세부 설정을 추가할 수 있습니다.
  // experimental: {
  //   serverActions: {
  //     bodySizeLimit: "2mb",
  //   },
  // },
};

export default nextConfig;
