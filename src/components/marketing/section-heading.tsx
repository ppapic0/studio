type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  light?: boolean;
};

export function SectionHeading({ eyebrow, title, description, light = false }: SectionHeadingProps) {
  return (
    <div className="max-w-3xl">
      <p className={`text-[11px] font-black tracking-[0.24em] ${light ? "text-[#FFB273]" : "text-[#FF7A16]"}`}>{eyebrow}</p>
      <h2
        className={`font-brand mt-3 break-keep text-[2.15rem] font-black leading-[1.08] tracking-[-0.045em] sm:text-[2.9rem] ${
          light ? "text-white" : "text-[#14295F]"
        }`}
      >
        {title}
      </h2>
      {description ? (
        <p className={`mt-4 max-w-2xl break-keep text-[15px] font-medium leading-[1.82] sm:text-[16px] ${light ? "text-white/84" : "text-slate-600"}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
