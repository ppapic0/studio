import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

type AuthFormWrapperProps = {
  children: React.ReactNode;
  title: string;
  subtitle: string;
};

const loginBg = PlaceHolderImages.find(
  (img) => img.id === 'login-background'
);

export function AuthFormWrapper({
  children,
  title,
  subtitle,
}: AuthFormWrapperProps) {
  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-[380px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-headline font-bold text-primary">공부트랙관리형독서실</h1>
            <h2 className="text-3xl font-headline font-bold">{title}</h2>
            <p className="text-balance text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
      <div className="hidden bg-muted lg:block relative">
        {loginBg && (
          <Image
            src={loginBg.imageUrl}
            alt={loginBg.description}
            data-ai-hint={loginBg.imageHint}
            fill
            className="object-cover"
          />
        )}
      </div>
    </div>
  );
}
