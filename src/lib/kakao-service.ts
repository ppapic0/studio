
import { Firestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { format, differenceInDays } from 'date-fns';

/**
 * 카카오 알림톡 서비스 (알리고/솔라피 등 외부 API 연동용)
 * 실제 서비스 시에는 발급받은 API Key와 발신번호를 환경변수에 등록하여 사용하세요.
 */

const KAKAO_API_KEY = process.env.NEXT_PUBLIC_KAKAO_API_KEY || 'YOUR_API_KEY';
const SENDER_NUMBER = '01012345678'; // 센터 인증 발신번호

type KakaoMessageType = 'entry' | 'exit' | 'away' | 'report' | 'payment_reminder';

interface SendMessageParams {
  studentName: string;
  parentPhone?: string;
  type: KakaoMessageType;
  customData?: any;
}

export async function sendKakaoNotification(db: Firestore, centerId: string, params: SendMessageParams) {
  const { studentName, type, customData } = params;
  
  // 1. 부모님 연락처 조회 로직 (실제 운영 시 StudentProfile 이나 User 문서에 저장된 연락처 사용)
  // 여기서는 시스템 로그에 출력하는 것으로 프로세스를 증명합니다.
  
  let message = '';
  const nowStr = format(new Date(), 'HH:mm');

  switch (type) {
    case 'entry':
      message = `[트랙학습센터] ${studentName} 학생이 ${nowStr}에 등원(입실)하였습니다. 오늘도 열공! ✍️`;
      break;
    case 'exit':
      message = `[트랙학습센터] ${studentName} 학생이 ${nowStr}에 하원(퇴실)하였습니다. 수고하셨습니다. 🏠`;
      break;
    case 'away':
      message = `[트랙학습센터] ${studentName} 학생이 ${nowStr}에 외출/휴식을 시작하였습니다. ☕`;
      break;
    case 'report':
      message = `[트랙학습센터] ${studentName} 학생의 오늘자 정밀 분석 리포트가 도착했습니다. 앱에서 확인해 주세요. ✨`;
      break;
    case 'payment_reminder':
      message = `[트랙학습센터] 안녕하세요 학부모님, ${studentName} 학생의 이번 달 수강료 결제일이 3일 남았습니다. (기한: ${customData?.dueDate})`;
      break;
  }

  // --- 실제 API 호출 영역 (예시: Aligo API) ---
  /*
  const response = await fetch('https://apis.aligo.in/send/', {
    method: 'POST',
    body: new URLSearchParams({
      key: KAKAO_API_KEY,
      msg: message,
      receiver: params.parentPhone || '01000000000',
      sender: SENDER_NUMBER
    })
  });
  */
  
  console.log(`[KAKAO NOTIFICATION] To: ${studentName} Parent | Content: ${message}`);
  return { success: true, message: '발송 예약 완료' };
}

/**
 * 결제 3일 전 학생들 찾아서 일괄 알림 발송
 */
export async function autoCheckPaymentReminders(db: Firestore, centerId: string) {
  const invoicesRef = collection(db, 'centers', centerId, 'invoices');
  const q = query(invoicesRef, where('status', '==', 'issued'));
  const snap = await getDocs(q);
  
  let sentCount = 0;
  const today = new Date();

  for (const d of snap.docs) {
    const data = d.data();
    const dueDate = data.cycleEndDate.toDate();
    const daysLeft = differenceInDays(dueDate, today);

    // 딱 3일 남았을 때 발송
    if (daysLeft === 3) {
      await sendKakaoNotification(db, centerId, {
        studentName: data.studentName,
        type: 'payment_reminder',
        customData: { dueDate: format(dueDate, 'yyyy-MM-dd') }
      });
      sentCount++;
    }
  }

  return sentCount;
}
