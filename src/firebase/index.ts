import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { firebaseConfig } from './config';

function initializeFirebase() {
  const apps = getApps();
  const firebaseApp = apps.length ? apps[0] : initializeApp(firebaseConfig);
  const firestore = getFirestore(firebaseApp);
  const auth = getAuth(firebaseApp);
  const functions = getFunctions(firebaseApp);
  // To connect to the functions emulator, uncomment the following lines:
  // import { connectFunctionsEmulator } from 'firebase/functions';
  // if (process.env.NODE_ENV === 'development') {
  //   connectFunctionsEmulator(functions, "localhost", 5001);
  // }
  return { firebaseApp, firestore, auth, functions };
}

export { initializeFirebase };

export * from './provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
