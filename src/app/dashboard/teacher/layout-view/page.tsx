
import { redirect } from 'next/navigation';

export default function LayoutViewPage() {
  // 이 페이지는 이제 홈 대시보드(TeacherDashboard)에 통합되었습니다.
  // 홈 대시보드에서 [배치 수정하기] 버튼을 통해 모든 관리 기능을 사용할 수 있습니다.
  redirect('/dashboard');
  
  return null;
}
