type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  light?: boolean;
};

export function SectionHeading({ eyebrow, title, description, light = false }: SectionHeadingProps) {
  return (
    <div className="max-w-3xl">
      <p className={`text-xs font-black tracking-[0.2em] ${light ? "text-[#FFB273]" : "text-[#FF7A16]"}`}>{eyebrow}</p>
      <h2
        className={`font-display mt-3 break-keep text-3xl font-bold leading-tight sm:text-4xl ${
          light ? "text-white" : "text-[#14295F]"
        }`}
      >
        {title}
      </h2>
      {description ? (
        <p className={`mt-4 break-keep text-base font-bold leading-relaxed ${light ? "text-white/80" : "text-slate-600"}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
