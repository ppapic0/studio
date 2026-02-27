import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const region = "asia-northeast3";

/**
 * 선생님이 학생 계정을 직접 생성하고 센터에 등록하는 함수
 */
export const registerStudent = functions.region(region).https.onCall(async (data, context) => {
  // 1. 권한 확인 (로그인 여부 및 선생님 역할 확인)
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  
  const { email, password, displayName, schoolName, grade, centerId } = data;
  
  if (!email || !password || !displayName || !schoolName || !centerId) {
    throw new functions.https.HttpsError("invalid-argument", "필수 정보가 누락되었습니다.");
  }

  // 호출자가 해당 센터의 선생님인지 확인
  const callerId = context.auth.uid;
  const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerId}`).get();
  const callerData = callerMemberSnap.data();
  
  if (!callerMemberSnap.exists || !['teacher', 'centerAdmin'].includes(callerData?.role)) {
    throw new functions.https.HttpsError("permission-denied", "학생을 등록할 권한이 없습니다.");
  }

  try {
    // 2. Auth 계정 생성
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    const uid = userRecord.uid;
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // 3. Firestore 데이터 일괄 생성 (트랜잭션)
    await db.runTransaction(async (transaction) => {
      // 기본 프로필
      transaction.set(db.doc(`users/${uid}`), {
        id: uid,
        email,
        displayName,
        schoolName,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // 센터 멤버십
      transaction.set(db.doc(`centers/${centerId}/members/${uid}`), {
        id: uid,
        centerId,
        role: 'student',
        status: "active",
        joinedAt: timestamp,
        displayName,
      });

      // 사용자 센터 역인덱스 (AuthGuard용)
      transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
        id: centerId,
        centerId,
        role: 'student',
        status: "active",
        joinedAt: timestamp,
      });

      // 학생 상세 프로필
      transaction.set(db.doc(`centers/${centerId}/students/${uid}`), {
        id: uid,
        name: displayName,
        schoolName,
        grade,
        seatNo: 0,
        targetDailyMinutes: 360,
        parentUids: [],
        createdAt: timestamp,
      });

      // 성장 로드맵 초기화
      transaction.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), {
        level: 1,
        currentXp: 0,
        nextLevelXp: 1000,
        stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
        skills: {},
        updatedAt: timestamp,
      });
    });

    return { ok: true, message: "학생 등록 완료" };
  } catch (error: any) {
    console.error("Register Student Error:", error);
    throw new functions.https.HttpsError("internal", error.message || "학생 등록 중 서버 오류가 발생했습니다.");
  }
});

/**
 * 학부모 피드백이 'final' 상태로 업데이트되면 messageQueue에 적재
 */
export const onParentFeedbackFinalized = functions.region(region).firestore
  .document('centers/{centerId}/parentFeedbackDrafts/{draftId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const { centerId } = context.params;

    if (before.status !== 'final' && after.status === 'final') {
      const messageId = `msg_${Date.now()}_${after.studentId}`;
      
      await db.collection('messageQueue').doc(messageId).set({
        centerId,
        studentId: after.studentId,
        teacherId: after.teacherId,
        type: "parentFeedback",
        payload: {
          yyyymmdd: after.yyyymmdd,
          content: after.contentDraft
        },
        status: "queued",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await db.collection(`centers/${centerId}/parentFeedbackLogs`).add({
        studentId: after.studentId,
        teacherId: after.teacherId,
        yyyymmdd: after.yyyymmdd,
        contentFinal: after.contentDraft,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "queued",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });

/**
 * 공부 세션이 종료(endedAt 존재)되면 일일 누적 데이터 업데이트
 */
export const onStudySessionEnded = functions.region(region).firestore
  .document('centers/{centerId}/studySessions/{sessionId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { centerId } = context.params;

    if (data.endedAt && data.minutes > 0) {
      const dateStr = data.startedAt.toDate().toISOString().split('T')[0].replace(/-/g, '');
      const aggId = `${data.studentId}_${dateStr}`;
      const aggRef = db.doc(`centers/${centerId}/dailyStudyAgg/${aggId}`);

      await aggRef.set({
        studentId: data.studentId,
        yyyymmdd: dateStr,
        totalMinutes: admin.firestore.FieldValue.increment(data.minutes),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

async function bootstrapUserToCenter(
  transaction: admin.firestore.Transaction,
  uid: string,
  email: string,
  displayName: string,
  centerId: string,
  role: string
) {
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const centerRef = db.doc(`centers/${centerId}`);
  const userRef = db.doc(`users/${uid}`);
  const memberRef = db.doc(`centers/${centerId}/members/${uid}`);
  const userCenterRef = db.doc(`userCenters/${uid}/centers/${centerId}`);

  const centerSnap = await transaction.get(centerRef);
  if (!centerSnap.exists) {
    transaction.set(centerRef, {
      id: centerId,
      name: centerId === 'learning-lab-dongbaek' ? "공부트랙 동백센터" : `센터 (${centerId})`,
      subscriptionTier: "Pro",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  transaction.set(userRef, {
    id: uid,
    email,
    displayName,
    updatedAt: timestamp,
    createdAt: timestamp,
  }, { merge: true });

  transaction.set(memberRef, {
    role,
    status: "active",
    joinedAt: timestamp,
    displayName,
  });

  transaction.set(userCenterRef, {
    role,
    status: "active",
    joinedAt: timestamp,
  });
}

export const redeemInviteCode = functions.region(region).https.onCall(async (data: any, context: functions.https.CallableContext) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  const { code } = data;
  if (!code) throw new functions.https.HttpsError("invalid-argument", "초대 코드가 누락되었습니다.");
  const uid = context.auth.uid;
  const email = context.auth.token.email || `${uid}@example.com`;
  const displayName = context.auth.token.name || email.split('@')[0];

  try {
    return await db.runTransaction(async (transaction) => {
      const inviteRef = db.doc(`inviteCodes/${code}`);
      const inviteSnap = await transaction.get(inviteRef);
      if (!inviteSnap.exists) throw new functions.https.HttpsError("not-found", "유효하지 않은 초대 코드입니다.");
      const inviteData = inviteSnap.data()!;
      const centerId = inviteData.centerId;
      const role = inviteData.intendedRole || 'student';
      if (inviteData.maxUses && inviteData.usedCount >= inviteData.maxUses) throw new functions.https.HttpsError("resource-exhausted", "이 초대 코드는 더 이상 사용할 수 없습니다.");
      await bootstrapUserToCenter(transaction, uid, email, displayName, centerId, role);
      transaction.update(inviteRef, {
        usedCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { ok: true, message: "가입이 완료되었습니다!" };
    });
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error.message || "서버 내부 오류");
  }
});

export const devJoinCenter = functions.region(region).https.onCall(async (data: any, context: functions.https.CallableContext) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
  const { centerId, role } = data;
  const uid = context.auth.uid;
  const email = context.auth.token.email || `${uid}@example.com`;
  const displayName = context.auth.token.name || "개발자";
  try {
    await db.runTransaction(async (transaction) => {
      await bootstrapUserToCenter(transaction, uid, email, displayName, centerId, role);
    });
    return { ok: true, message: "강제 가입 성공!" };
  } catch (error: any) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});