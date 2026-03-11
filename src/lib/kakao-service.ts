import { Firestore, collection, query, where, getDocs } from 'firebase/firestore';
import { format, differenceInDays } from 'date-fns';

/**
 * 알리고(Aligo) SMS API 서비스 연동
 *
 * [운영 가이드]
 * 1. 알리고(https://aligo.in) 가입 및 포인트 충전
 * 2. API Key, User ID 발급
 * 3. 발신번호 등록 및 인증
 * 4. .env.local 파일에 아래 키값을 등록하세요. (NEXT_PUBLIC_ 접두사 사용 금지 - 서버 전용)
 *    - ALIGO_API_KEY=...
 *    - ALIGO_USER_ID=...
 *    - ALIGO_SENDER=...
 */

const ALIGO_API_KEY = process.env.ALIGO_API_KEY || 'YOUR_API_KEY';
const ALIGO_USER_ID = process.env.ALIGO_USER_ID || 'YOUR_USER_ID';
const SENDER_NUMBER = process.env.ALIGO_SENDER || '01012345678';

type KakaoMessageType = 'entry' | 'exit' | 'away' | 'report' | 'payment_reminder';

interface SendMessageParams {
  studentName: string;
  parentPhone?: string; // 학부모 연락처 (01012345678 형식)
  type: KakaoMessageType;
  customData?: any;
}

/**
 * 알리고 API를 통해 SMS를 발송하는 핵심 함수
 */
export async function sendKakaoNotification(db: Firestore, centerId: string, params: SendMessageParams) {
  const { studentName, type, customData, parentPhone } = params;
  
  // 1. 메시지 내용 구성
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

  // 2. 알리고 API 호출용 데이터 구성
  // 주의: 브라우저 환경에서 직접 호출 시 CORS 정책에 의해 차단될 수 있습니다. 
  // 실제 상용 환경에서는 Next.js API Route(서버측)를 통해 호출하도록 구성하는 것이 정석입니다.
  try {
    const formData = new URLSearchParams();
    formData.append('key', ALIGO_API_KEY);
    formData.append('userid', ALIGO_USER_ID);
    formData.append('sender', SENDER_NUMBER);
    formData.append('receiver', parentPhone || '01000000000'); // 수신자 번호 (없을 시 테스트 번호)
    formData.append('msg', message);
    
    // 알리고 API 특화 필드
    formData.append('msg_type', 'SMS'); // 단문 기준
    formData.append('testbar', 'Y');    // 'Y'인 경우 실제 발송되지 않고 테스트 성공만 반환함. 실제 서비스 시 'N'으로 변경.

    console.log(`[ALIGO SMS LOG]
------------------------------------
Recipient: ${studentName} (${parentPhone || 'No Phone'})
Type: ${type}
Message: ${message}
------------------------------------`);

    // 실제 API 연동 시 아래 주석을 해제하세요.
    /*
    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });
    const result = await response.json();
    console.log('[ALIGO RESPONSE]', result);
    return result;
    */
    
    return { success: true, message: '알림 전송 요청 완료 (시뮬레이션)' };
  } catch (error) {
    console.error('[ALIGO API ERROR]', error);
    throw error;
  }
}

/**
 * 수납 관리 탭에서 호출: 결제일 3일 전인 미납 항목을 찾아 일괄 알림 발송
 */
export async function autoCheckPaymentReminders(db: Firestore, centerId: string) {
  const invoicesRef = collection(db, 'centers', centerId, 'invoices');
  const q = query(invoicesRef, where('status', '==', 'issued'));
  const snap = await getDocs(q);
  
  let sentCount = 0;
  const today = new Date();

  for (const d of snap.docs) {
    const data = d.data();
    if (!data.cycleEndDate) continue;
    
    const dueDate = data.cycleEndDate.toDate();
    const daysLeft = differenceInDays(dueDate, today);

    // 딱 3일 남았을 때 발송 로직
    if (daysLeft === 3) {
      // 실제 학생/부모의 연락처 정보를 Firestore에서 조회하여 parentPhone에 넣어줄 수 있습니다.
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
