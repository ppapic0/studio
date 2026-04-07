const admin = require('firebase-admin');

function resolveServiceAccountCredential() {
  const rawJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
      ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
      : '');

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed.clientEmail && parsed.privateKey) {
        return admin.credential.cert({
          ...parsed,
          privateKey: parsed.privateKey.replace(/\\n/g, '\n'),
        });
      }
    } catch {
      // Fallback to explicit env vars below.
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64?.trim();
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY?.trim();
  const privateKey = privateKeyBase64
    ? Buffer.from(privateKeyBase64, 'base64').toString('utf8')
    : privateKeyRaw?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    return admin.credential.cert({
      projectId:
        process.env.FIREBASE_PROJECT_ID ||
        process.env.GCLOUD_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        'studio-2815552762-86e0f',
      clientEmail,
      privateKey,
    });
  }

  return undefined;
}

function initAdmin() {
  if (admin.apps.length) return;

  const credential = resolveServiceAccountCredential();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'studio-2815552762-86e0f';

  admin.initializeApp(
    credential
      ? {
          credential,
          projectId,
        }
      : {
          projectId,
        },
  );
}

function parseArgs(argv) {
  const args = { write: false, centerId: null };
  argv.forEach((arg) => {
    if (arg === '--write') {
      args.write = true;
      return;
    }
    if (arg.startsWith('--center=')) {
      args.centerId = arg.slice('--center='.length).trim() || null;
      return;
    }
    if (arg.startsWith('--centerId=')) {
      args.centerId = arg.slice('--centerId='.length).trim() || null;
    }
  });
  return args;
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function pickBillingPayload({ centerId, studentId, existing, memberData, studentData }) {
  const payload = {
    centerId,
    studentId,
    monthlyFee:
      memberData?.monthlyFee ??
      studentData?.monthlyFee ??
      existing?.monthlyFee ??
      null,
    baseFee:
      memberData?.baseFee ??
      existing?.baseFee ??
      null,
    tutoringDiscount:
      memberData?.tutoringDiscount ??
      existing?.tutoringDiscount ??
      null,
    siblingDiscount:
      memberData?.siblingDiscount ??
      existing?.siblingDiscount ??
      null,
    currentEnrollment:
      studentData?.currentEnrollment ??
      existing?.currentEnrollment ??
      null,
  };

  const hasBillingValue = [
    payload.monthlyFee,
    payload.baseFee,
    payload.tutoringDiscount,
    payload.siblingDiscount,
    payload.currentEnrollment,
  ].some((value) => value !== null && value !== undefined);

  return hasBillingValue ? payload : null;
}

function buildLegacyDeletePatch(source, keys) {
  const patch = {};
  keys.forEach((key) => {
    if (source && Object.prototype.hasOwnProperty.call(source, key)) {
      patch[key] = admin.firestore.FieldValue.delete();
    }
  });
  return patch;
}

async function migrateCenter(db, centerId, write) {
  const centerRef = db.collection('centers').doc(centerId);
  const [membersSnap, studentsSnap, billingProfilesSnap] = await Promise.all([
    centerRef.collection('members').get(),
    centerRef.collection('students').get(),
    centerRef.collection('billingProfiles').get(),
  ]);

  const studentMembers = new Map(
    membersSnap.docs
      .filter((docSnap) => {
        const data = docSnap.data() || {};
        return (data.role || null) === 'student';
      })
      .map((docSnap) => [docSnap.id, { ref: docSnap.ref, data: docSnap.data() || {} }]),
  );
  const studentProfiles = new Map(
    studentsSnap.docs.map((docSnap) => [docSnap.id, { ref: docSnap.ref, data: docSnap.data() || {} }]),
  );
  const billingProfiles = new Map(
    billingProfilesSnap.docs.map((docSnap) => [docSnap.id, { ref: docSnap.ref, data: docSnap.data() || {} }]),
  );

  const studentIds = new Set([
    ...studentMembers.keys(),
    ...studentProfiles.keys(),
    ...billingProfiles.keys(),
  ]);

  const billingWrites = [];
  const memberDeletes = [];
  const studentDeletes = [];

  studentIds.forEach((studentId) => {
    const memberEntry = studentMembers.get(studentId);
    const studentEntry = studentProfiles.get(studentId);
    const existingProfile = billingProfiles.get(studentId);
    const billingPayload = pickBillingPayload({
      centerId,
      studentId,
      existing: existingProfile?.data,
      memberData: memberEntry?.data,
      studentData: studentEntry?.data,
    });

    if (billingPayload) {
      billingWrites.push({
        ref: centerRef.collection('billingProfiles').doc(studentId),
        data: billingPayload,
        existing: existingProfile?.data || null,
      });
    }

    const memberDeletePatch = buildLegacyDeletePatch(memberEntry?.data, [
      'monthlyFee',
      'baseFee',
      'tutoringDiscount',
      'siblingDiscount',
    ]);
    if (memberEntry && Object.keys(memberDeletePatch).length > 0) {
      memberDeletes.push({ ref: memberEntry.ref, patch: memberDeletePatch });
    }

    const studentDeletePatch = buildLegacyDeletePatch(studentEntry?.data, [
      'monthlyFee',
      'currentEnrollment',
    ]);
    if (studentEntry && Object.keys(studentDeletePatch).length > 0) {
      studentDeletes.push({ ref: studentEntry.ref, patch: studentDeletePatch });
    }
  });

  if (write) {
    const batches = [];

    chunk(billingWrites, 125).forEach((billingChunk, index) => {
      const deleteChunk = chunk([...memberDeletes, ...studentDeletes], 250)[index] || [];
      const batch = db.batch();
      billingChunk.forEach(({ ref, data, existing }) => {
        batch.set(
          ref,
          {
            ...data,
            createdAt: existing?.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });
      deleteChunk.forEach(({ ref, patch }) => {
        batch.update(ref, patch);
      });
      batches.push(batch.commit());
    });

    const remainingDeleteChunks = chunk([...memberDeletes, ...studentDeletes], 250).slice(
      chunk(billingWrites, 125).length,
    );
    remainingDeleteChunks.forEach((deleteChunk) => {
      const batch = db.batch();
      deleteChunk.forEach(({ ref, patch }) => {
        batch.update(ref, patch);
      });
      batches.push(batch.commit());
    });

    await Promise.all(batches);
  }

  return {
    centerId,
    billingProfilesPrepared: billingWrites.length,
    memberLegacyDeletes: memberDeletes.length,
    studentLegacyDeletes: studentDeletes.length,
  };
}

async function main() {
  const { write, centerId } = parseArgs(process.argv.slice(2));
  initAdmin();

  const db = admin.firestore();
  const centerIds = centerId
    ? [centerId]
    : (await db.collection('centers').listDocuments()).map((docRef) => docRef.id);

  if (centerIds.length === 0) {
    console.log('No centers found.');
    return;
  }

  console.log(
    `[billing-profiles] ${write ? 'write mode' : 'dry run'} for ${centerIds.length} center(s)`,
  );

  let totalBillingProfilesPrepared = 0;
  let totalMemberLegacyDeletes = 0;
  let totalStudentLegacyDeletes = 0;

  for (const nextCenterId of centerIds) {
    const result = await migrateCenter(db, nextCenterId, write);
    totalBillingProfilesPrepared += result.billingProfilesPrepared;
    totalMemberLegacyDeletes += result.memberLegacyDeletes;
    totalStudentLegacyDeletes += result.studentLegacyDeletes;

    console.log(
      `[billing-profiles] ${nextCenterId}: profiles=${result.billingProfilesPrepared}, memberLegacyDeletes=${result.memberLegacyDeletes}, studentLegacyDeletes=${result.studentLegacyDeletes}`,
    );
  }

  console.log(
    `[billing-profiles] done: profiles=${totalBillingProfilesPrepared}, memberLegacyDeletes=${totalMemberLegacyDeletes}, studentLegacyDeletes=${totalStudentLegacyDeletes}`,
  );

  if (!write) {
    console.log('[billing-profiles] rerun with --write to apply the migration.');
  }
}

main().catch((error) => {
  console.error('[billing-profiles] migration failed');
  console.error(error);
  process.exitCode = 1;
});
