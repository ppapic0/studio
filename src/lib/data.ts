import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Student } from './types';

// Static fallback data only. Live dashboards should prefer Firestore data.
export const mockStudents: Student[] = [
  { id: 'student-1', name: '민준', avatarUrl: PlaceHolderImages.find((item) => item.id === 'student-avatar-1')?.imageUrl ?? '' },
  { id: 'student-2', name: '서윤', avatarUrl: PlaceHolderImages.find((item) => item.id === 'student-avatar-2')?.imageUrl ?? '' },
  { id: 'student-3', name: '지후', avatarUrl: PlaceHolderImages.find((item) => item.id === 'student-avatar-3')?.imageUrl ?? '' },
  { id: 'student-4', name: '하린', avatarUrl: PlaceHolderImages.find((item) => item.id === 'student-avatar-4')?.imageUrl ?? '' },
  { id: 'student-5', name: '도윤', avatarUrl: PlaceHolderImages.find((item) => item.id === 'student-avatar-5')?.imageUrl ?? '' },
];
