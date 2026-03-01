
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

type AuthFormWrapperProps = {
  children: React.ReactNode;
  title: React.ReactNode;
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
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="mx-auto grid w-full max-w-[400px] gap-8">
          <div className="grid gap-3 text-center">
            <h2 className="text-3xl font-headline font-bold tracking-tight text-foreground">{title}</h2>
            <p className="text-balance text-muted-foreground font-medium">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
      <div className="hidden bg-muted lg:block relative overflow-hidden">
        {loginBg && (
          <>
            <Image
              src={loginBg.imageUrl}
              alt={loginBg.description}
              data-ai-hint={loginBg.imageHint}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-12 left-12 right-12 text-white">
              <p className="text-sm font-black uppercase tracking-[0.3em] opacity-60 mb-2">Perspective & Momentum</p>
              <h3 className="text-4xl font-black tracking-tighter leading-none italic">UNSTOPPABLE GROWTH</h3>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
