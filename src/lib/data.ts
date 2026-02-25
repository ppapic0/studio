import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Student } from './types';

// This file now only contains data that is truly static or for fallback.
// Most mock data has been removed as components now fetch live data.

export const mockStudents: Student[] = [
  { id: 'student-1', name: '이소피아', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-1')?.imageUrl ?? '' },
  { id: 'student-2', name: '벤 카터', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-2')?.imageUrl ?? '' },
  { id: 'student-3', name: '미아 가르시아', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-3')?.imageUrl ?? '' },
  { id: 'student-4', name: '레오 마르티네즈', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-4')?.imageUrl ?? '' },
  { id: 'student-5', name: '클로이 킴', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-5')?.imageUrl ?? '' },
];
