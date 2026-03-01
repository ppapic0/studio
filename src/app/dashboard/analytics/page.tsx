import { redirect } from 'next/navigation';

export default function AnalyticsPage() {
  // 센터 분석 페이지는 이제 수익 분석으로 대체되거나 이동되었습니다.
  // 관리자가 이 경로로 직접 접근할 경우 수익 분석 페이지로 리디렉션합니다.
  redirect('/dashboard/revenue');
  
  return null;
}
