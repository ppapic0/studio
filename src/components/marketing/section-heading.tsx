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
        className={`font-aggro-display mt-4 break-keep text-[clamp(2rem,4.8vw,3rem)] font-black leading-[1.04] ${
          light ? "text-white" : "text-[#14295F]"
        }`}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={`mt-4 max-w-2xl break-keep text-[15px] font-bold leading-[1.82] sm:text-[15.5px] ${
    light ? "text-white/[0.85]" : "text-[#2c3f58]"
          }`}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
