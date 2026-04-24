'use client';

import {
  ATTENDANCE_REQUEST_PROOF_MAX_EDGE,
  ATTENDANCE_REQUEST_PROOF_TARGET_BYTES,
} from '@/lib/attendance-request';

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지 변환에 실패했습니다.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

export async function compressAttendanceRequestProofImage(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImageElement(source);
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight, 1);
  const scale = Math.min(1, ATTENDANCE_REQUEST_PROOF_MAX_EDGE / longestEdge);
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('이미지 처리 도구를 준비하지 못했습니다.');
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  let quality = 0.9;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > ATTENDANCE_REQUEST_PROOF_TARGET_BYTES && quality > 0.45) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }

  return {
    blob,
    width: targetWidth,
    height: targetHeight,
    contentType: 'image/jpeg',
  };
}
