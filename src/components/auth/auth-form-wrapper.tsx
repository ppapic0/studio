type AuthFormWrapperProps = {
  children: React.ReactNode;
  title: React.ReactNode;
  subtitle: string;
};

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
            <div className="mb-2">{title}</div>
            {subtitle.trim() ? <p className="text-balance text-muted-foreground font-medium">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </div>

      <div className="hidden lg:block relative overflow-hidden bg-[#14295F]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/login-fireworks.png')" }}
        />
      </div>
    </div>
  );
}
