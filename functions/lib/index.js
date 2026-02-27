const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const region = "asia-northeast3";

/**
 * 선생님이 학생 계정을 직접 생성하고 센터에 등록하는 함수
 */
exports.registerStudent = functions.region(region).https.onCall(async (data, context) => {
    // 1. 인증 확인
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    
    const { email, password, displayName, schoolName, grade, centerId } = data;
    
    // 2. 입력값 검증
    if (!email || !password || !displayName || !schoolName || !centerId) {
        throw new functions.https.HttpsError("invalid-argument", "모든 필수 정보를 입력해 주세요.");
    }

    const callerId = context.auth.uid;

    try {
        // 3. 호출자 권한 확인 (선생님/관리자 여부)
        const callerMemberRef = db.doc(`centers/${centerId}/members/${callerId}`);
        const callerMemberSnap = await callerMemberRef.get();
        
        if (!callerMemberSnap.exists || !['teacher', 'centerAdmin'].includes(callerMemberSnap.data()?.role)) {
            throw new functions.https.HttpsError("permission-denied", "이 센터에 학생을 등록할 권한이 없습니다.");
        }

        // 4. Firebase Auth 계정 생성
        let userRecord;
        try {
            userRecord = await admin.auth().createUser({
                email,
                password,
                displayName,
            });
        } catch (authError) {
            console.error("[RegisterStudent] Auth Creation Error:", authError);
            if (authError.code === 'auth/email-already-exists') {
                throw new functions.https.HttpsError("already-exists", "이미 가입된 이메일 주소입니다.");
            }
            throw new functions.https.HttpsError("internal", `계정 생성 실패: ${authError.message}`);
        }

        const uid = userRecord.uid;
        const timestamp = admin.firestore.Timestamp.now();

        // 5. Firestore 데이터 저장 (트랜잭션)
        try {
            await db.runTransaction(async (transaction) => {
                // (1) 공통 유저 프로필
                transaction.set(db.doc(`users/${uid}`), {
                    id: uid,
                    email,
                    displayName,
                    schoolName,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                });

                // (2) 센터 내 멤버 정보
                transaction.set(db.doc(`centers/${centerId}/members/${uid}`), {
                    id: uid,
                    centerId: centerId,
                    role: 'student',
                    status: "active",
                    joinedAt: timestamp,
                    displayName,
                });

                // (3) 사용자별 가입 센터 역인덱스
                transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
                    id: centerId,
                    centerId: centerId,
                    role: 'student',
                    status: "active",
                    joinedAt: timestamp,
                });

                // (4) 학생 상세 교육용 프로필
                transaction.set(db.doc(`centers/${centerId}/students/${uid}`), {
                    id: uid,
                    name: displayName,
                    schoolName,
                    grade,
                    seatNo: 0,
                    targetDailyMinutes: 360,
                    parentUids: [],
                    createdAt: timestamp,
                    updatedAt: timestamp,
                });

                // (5) 성장 로드맵 초기화
                transaction.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), {
                    level: 1,
                    currentXp: 0,
                    nextLevelXp: 1000,
                    stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
                    skills: {},
                    updatedAt: timestamp,
                });
            });
        } catch (dbError) {
            console.error("[RegisterStudent] Transaction Error:", dbError);
            // Auth는 생성되었으나 DB 저장에 실패한 경우 사용자 정리가 필요할 수 있음
            throw new functions.https.HttpsError("internal", "데이터베이스 저장 중 오류가 발생했습니다.");
        }

        return { ok: true, uid, message: "학생 등록이 성공적으로 완료되었습니다." };

    } catch (error) {
        console.error("[RegisterStudent] Final Error:", error);
        // 이미 HttpsError인 경우 그대로 던지고, 아니면 internal로 래핑
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", error.message || "알 수 없는 서버 오류");
    }
});

/**
 * 초대 코드 사용 및 센터 가입 함수
 */
exports.redeemInviteCode = functions.region(region).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    
    const { code } = data;
    const uid = context.auth.uid;

    try {
        return await db.runTransaction(async (transaction) => {
            const inviteRef = db.doc(`inviteCodes/${code}`);
            const inviteSnap = await transaction.get(inviteRef);
            
            if (!inviteSnap.exists) throw new functions.https.HttpsError("not-found", "유효하지 않은 초대 코드입니다.");
            
            const inviteData = inviteSnap.data();
            const centerId = inviteData.centerId;
            const role = inviteData.intendedRole || 'student';
            const timestamp = admin.firestore.Timestamp.now();

            transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
                id: centerId,
                centerId: centerId,
                role,
                status: "active",
                joinedAt: timestamp,
            });

            transaction.set(db.doc(`centers/${centerId}/members/${uid}`), {
                id: uid,
                centerId: centerId,
                role,
                status: "active",
                joinedAt: timestamp,
                displayName: context.auth.token.name || context.auth.token.email.split('@')[0],
            });

            transaction.update(inviteRef, {
                usedCount: admin.firestore.FieldValue.increment(1),
                updatedAt: timestamp
            });

            return { ok: true, message: "센터 가입이 완료되었습니다." };
        });
    } catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
