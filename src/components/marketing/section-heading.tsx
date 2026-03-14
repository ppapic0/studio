type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  light?: boolean;
};

export function SectionHeading({ eyebrow, title, description, light = false }: SectionHeadingProps) {
  return (
    <div className="max-w-3xl">
      <div className={light ? 'eyebrow-badge-light' : 'eyebrow-badge'}>
        {eyebrow}
      </div>
      <h2
        className={`font-brand mt-4 break-keep text-[clamp(1.9rem,4.5vw,2.8rem)] leading-[1.04] tracking-[-0.045em] ${
          light ? "text-white" : "text-[#14295F]"
        }`}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={`mt-4 max-w-2xl break-keep text-[15px] font-medium leading-[1.82] sm:text-[15.5px] ${
            light ? "text-white/78" : "text-slate-600"
          }`}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
