import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "트랙 관리형 스터디센터/트랙 국어학원",
    short_name: "트랙 관리형 스터디센터/트랙 국어학원",
    description:
      "관리형 스터디센터 중심 운영, 수능 국어 그룹 수업, 학부모 앱과 학생 웹앱이 연결된 트랙의 학습 관리 시스템입니다.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#14295f",
    icons: [
      {
        src: "/icon-192.png?v=20260325",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png?v=20260325",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png?v=20260325",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
