import {
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  GraduationCap,
  Layers,
  Target,
  Users,
} from 'lucide-react';

import { AcademyFloatingCTA } from '@/components/marketing/academy-floating-cta';
import { ConsultForm } from '@/components/marketing/consult-form';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { StaggerChildren } from '@/components/marketing/stagger-children';
import { marketingContent } from '@/lib/marketing-content';

/* ?????????????????????????????????????????????????
   Static data ??defined here, not in marketing-content
   to keep this page self-contained and maintainable
????????????????????????????????????????????????? */

const career = [
  { label: '愿由ы삎 ?낆꽌???먯옣', detail: '遺꾨떦쨌?먭탳 愿由ы삎 ?ㅽ꽣?붿꽱???댁쁺 寃쏀뿕' },
  { label: '援?뼱 ?섏뾽 ?ㅼ닔 寃쎈젰', detail: '?섎뒫 援?뼱 媛쒖씤 吏??寃쏀뿕' },
  { label: '?먯옣 蹂몄씤 援?뼱 諛깅텇??99', detail: '2024?숇뀈???섎뒫 ?ㅼ쟾 湲곕줉' },
];

const results = [
  { school: '고려대학교', count: '2명', year: '26' },
  { school: '서강대학교', count: '1명', year: '26' },
  { school: '성균관대학교', count: '1명', year: '26' },
  { school: '홍익대학교', count: '1명', year: '26' },
  { school: '아주대학교', count: '1명', year: '26' },
];

const methods = [
  {
    icon: BookOpen,
    title: '?쎈뒗 諛⑹떇 ?뺣━',
    body: '吏臾?援ъ“瑜?鍮좊Ⅴ寃??↔퀬 ?듭떖 媛쒕뀗留??④린?꾨줉 ?쎈뒗 湲곗????몄썎?덈떎.',
  },
  {
    icon: Target,
    title: '?좎? ?먮떒 湲곗? ?뺣━',
    body: '?뺣떟 洹쇨굅? ?ㅻ떟 ?⑥젙??遺꾨━???좎? ?먮떒 ?띾룄? ?뺥솗?꾨? ?щ┰?덈떎.',
  },
  {
    icon: Users,
    title: '?숈깮蹂??쎌젏 蹂댁셿',
    body: '?숈깮留덈떎 ?ㅻⅨ ?쎌젏??吏꾨떒???꾩슂???ъ씤?몃쭔 吏묒쨷 蹂댁셿?⑸땲??',
  },
  {
    icon: Layers,
    title: '?먮즺 湲곕컲 ?섏뾽',
    body: '?먯옣 ?쒖옉 ?먮즺濡??섏뾽怨?蹂듭뒿 湲곗????섎굹濡?留욎땅?덈떎.',
  },
];

const materialPreviews = [
  {
    label: '?낆꽌 吏臾?遺꾩꽍 ?먮즺',
    tag: '吏臾?援ъ“ ?댁꽕',
    desc: '?⑤씫蹂??듭떖 ?뺣낫? ?곌껐 援ъ“瑜??뺣━???댁꽕 ?먮즺?낅땲??',
    focus: '援ъ“? 異쒖젣 ?ъ씤?몃? ???μ뿉???뺤씤',
  },
  {
    label: '?뱁빐?꾨룄 ?섎뒫 ?좊퀎 湲곗텧吏?,
    tag: '?섎뒫 湲곗텧 ?좊퀎',
    desc: '?뱁빐?꾨룄 ?섎뒫 寃쏀뼢??留욎떠 ?좊퀎??湲곗텧 臾명빆 ?댁꽕 ?먮즺?낅땲??',
    focus: '?듭떖 湲곗텧留??뺤텞???ㅼ쟾 湲곗? ?뺣━',
  },
  {
    label: '?ъ꽕 紐⑥쓽怨좎궗 ?댁꽕?먮즺',
    tag: '?ъ꽕 紐⑥쓽 ?댁꽕',
    desc: '二쇱슂 ?ъ꽕 紐⑥쓽怨좎궗 臾명빆???ш퀬 怨쇱젙怨??ㅻ떟 ?ъ씤?몃? ?뺣━?⑸땲??',
    focus: '?ㅼ쟾 媛먭컖怨??쒓컙 ?댁쁺源뚯? ?④퍡 ?먭?',
  },
];

const koreanMaterialPdfPath = '/materials/2026-korean-nonfiction-2passages-commentary.pdf';
const koreanMaterialPreviewImagePath = '/materials/2026-korean-nonfiction-2passages-commentary-page1.png';

const scoreProofCards = [
  {
    phase: '6??紐⑥쓽?됯?',
    result: '援?뼱 3?깃툒',
    detail: '諛깅텇??82',
    image: '/marketing/proof/june-mock-redacted.jpg',
  },
  {
    phase: '9??紐⑥쓽?됯?',
    result: '援?뼱 1?깃툒',
    detail: '諛깅텇??96',
    image: '/marketing/proof/september-mock-redacted.jpg',
  },
  {
    phase: '?섎뒫 蹂몄떆??,
    result: '援?뼱 諛깅텇??99',
    detail: '?ㅼ젣 ?깆쟻??湲곕컲',
    image: '/marketing/proof/csat-score-redacted.jpg',
  },
];

const kakaoFeedbackCards = [
  {
    label: '援?쁺???⑹궛 ?꾧탳 1???щ?',
    summary: '2025 怨? 6??쨌 ?숇갚怨?,
    detail: '?꾧낵紐?諛몃윴??肄붿묶',
    image: '/marketing/reviews/kakao-feedback-1-redacted.jpg',
    showFull: false,
  },
  {
    label: '臾명빆 吏덉쓽?묐떟',
    summary: '?쒗뿕 ???댁꽕 ???,
    image: '/marketing/reviews/kakao-feedback-3-redacted.jpg',
    showFull: true,
  },
];

const studentFits = [
  {
    title: '臾몄젣瑜?留롮씠 ??대룄 ?깆쟻???????ㅻⅤ???숈깮',
    body: '??대웾蹂대떎 癒쇱?, ?쎈뒗 諛⑹떇怨??먮떒 湲곗????먭??댁빞 ?섎뒗 寃쎌슦媛 留롮뒿?덈떎.',
  },
  {
    title: '援?뼱瑜?媛먯쑝濡??怨??덈뒗 ?숈깮',
    body: '留욊퀬 ?由ш퀬???댁쑀瑜?遺꾨챸?섍쾶 ?ㅻ챸?????덉뼱???깆쟻???덉젙?⑸땲??',
  },
  {
    title: '?ы븰??쨌 N?섏깮 紐⑤몢',
    body: '?꾩옱 ?꾩튂???곕씪 ?꾩슂??諛⑹떇? ?щ씪吏묐땲?? ?숈깮 ?곹솴??留욊쾶 ?섏뾽 諛⑺뼢???≪뒿?덈떎.',
  },
  {
    title: '愿由ъ? ?섏뾽???④퍡 媛?멸?怨??띠? ?숈깮',
    body: '?ㅽ꽣?붿꽱???댁쁺怨??④퍡 ?곌껐?????덉젙?곸씤 ?숈뒿 ?먮쫫??留뚮뱾 ???덉뒿?덈떎.',
  },
];

const contactItems = [
  { label: 'CONTACT', value: marketingContent.consult.contactLine },
  { label: 'LOCATION', value: marketingContent.consult.locationLine },
  { label: 'HOURS', value: marketingContent.consult.hoursLine },
];

/* ?????????????????????????????????????????????????
   Page
????????????????????????????????????????????????? */

export default function ClassPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />

      {/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
          1. HERO
      ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */}
      <section
        className="on-dark relative flex min-h-[92svh] items-center overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #080f28 0%, #0d1d47 50%, #0b1631 100%)' }}
      >
        {/* subtle radial ambience */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_12%_0%,rgba(22,55,155,0.44),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_88%_100%,rgba(20,41,95,0.4),transparent)]" />
        </div>

        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_0.82fr] lg:items-center lg:gap-16 lg:px-8 lg:py-24">
          {/* Left */}
          <div className="space-y-8">
            <span className="eyebrow-badge-light">?먯옣 吏곴컯 쨌 ?섎뒫 援?뼱</span>

            <div className="space-y-6">
              <h1 className="font-aggro-display break-keep text-[clamp(2.6rem,5.2vw,4.2rem)] font-black leading-[1.06] text-white">
                援?뼱??媛먯씠 ?꾨땲??
                <br />
                <span className="text-[#FF7A16]">洹쇨굅? 援ъ“</span>濡?
                <br />
                ?볦엯?덈떎
              </h1>
              <p className="max-w-[440px] break-keep text-[15.5px] font-semibold leading-[1.82] text-white/85">
                ?먯옣 吏곴컯?쇰줈 吏꾪뻾?⑸땲??
                吏곸젒 留뚮뱺 ?댁꽕 ?먮즺? ?섏뾽 ?먮즺瑜?諛뷀깢?쇰줈
                ?쎈뒗 諛⑹떇, ?좎? ?먮떒 湲곗?, ?곸슜 ?먮쫫源뚯? ?④퍡 ?≪븘媛묐땲??
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a href="#class-consult" className="premium-cta premium-cta-primary h-12 px-7 text-[14px]">
                ?섏뾽 ?곷떞 ?좎껌
              </a>
              <a href="#materials" className="premium-cta premium-cta-ghost h-12 px-7 text-[14px]">
                ?섏뾽?먮즺 誘몃━蹂닿린
              </a>
            </div>

            <p className="text-[12.5px] font-bold text-white/50">
              2026?숇뀈??쨌 怨좊젮? 2紐??ы븿 二쇱슂 ????⑷꺽
            </p>
          </div>

          {/* Right ??credential card */}
          <div className="hidden lg:block">
            <div
              className="rounded-[1.6rem] border p-8 space-y-6"
              style={{
                borderColor: 'rgba(255,255,255,0.11)',
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 1px 0 0 rgba(255,255,255,0.08) inset, 0 24px 48px -12px rgba(0,0,0,0.32)',
              }}
            >
              <p className="text-[10.5px] font-black tracking-[0.22em] text-[#FFB273] uppercase">
                2026 ?깃낵 쨌 ?섏뾽 ?좊ː??
              </p>

              {/* result grid */}
              <div className="grid grid-cols-2 gap-3">
                {results.map((r) => (
                  <div
                    key={r.school}
                    className="rounded-xl border border-white/8 bg-white/5 px-4 py-3"
                  >
                    <p className="text-[1.4rem] font-black leading-none text-white">{r.count}</p>
                    <p className="mt-1.5 break-keep text-[11.5px] font-semibold text-white/75">{r.school}</p>
                  </div>
                ))}
                <div className="rounded-xl border border-[#FF7A16]/22 bg-[#FF7A16]/8 px-4 py-3">
                  <p className="text-[1.4rem] font-black leading-none text-[#FF9848]">99</p>
                  <p className="mt-1.5 text-[11.5px] font-semibold text-[#FF9848]/70">?먯옣 援?뼱 諛깅텇??/p>
                </div>
              </div>

              {/* highlights */}
              <div className="space-y-2.5 border-t border-white/8 pt-5">
                {['?먯옣 吏곴컯', '吏곸젒 ?쒖옉 ?댁꽕 ?먮즺', '?숈깮蹂?留욎땄 蹂댁셿'].map((item) => (
                  <div key={item} className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#FF9848]" />
                    <span className="text-[13.5px] font-semibold text-white/90">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
          1.5 TAGLINE QUOTE
      ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */}
      <ScrollReveal>
        <section className="py-16 sm:py-20 bg-white">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="border-l-[5px] border-[#14295F] pl-6 py-1">
              <p className="break-keep text-[clamp(1.55rem,3.2vw,2.15rem)] font-black leading-[1.45] text-[#14295F]">
                怨듬???諛⑺뼢??以묒슂?⑸땲??
                <br />
                ?깆옣??湲? <span className="text-[#FF7A16]">?몃옓</span>?먯꽌 ?쒖옉?⑸땲??
              </p>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
          2. INTRO
      ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */}
      <ScrollReveal>
        <section className="py-20 sm:py-28" style={{ background: '#f4f7ff' }}>
          <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <span className="eyebrow-badge">?섏뾽 ?뚭컻</span>
            <h2 className="mt-5 break-keep text-[clamp(1.75rem,3.6vw,2.4rem)] font-black leading-[1.12] text-[#14295F]">
              援?뼱 ?섏뾽? ?대젃寃?吏꾪뻾?⑸땲??
            </h2>
            <p className="mx-auto mt-6 max-w-[560px] break-keep text-[15.5px] font-semibold leading-[1.88] text-[#334e6a]">
              ?⑥닚 諛섎났???꾨땲??湲곗????몄슦???섏뾽?낅땲??
              ?쎄린 援ъ“, ?좎? ?먮떒, ?쎌젏 蹂댁셿??吏㏐퀬 紐낇솗?섍쾶 ?덈젴?⑸땲??
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { icon: BookOpen, text: '?쎄린 援ъ“ ?뺣┰' },
                { icon: Target, text: '?먮떒 湲곗? ?뺣━' },
                { icon: GraduationCap, text: '?숈깮蹂?蹂댁셿' },
              ].map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-[rgba(20,41,95,0.10)] bg-white px-6 py-7"
                >
                  <Icon className="h-6 w-6 text-[#FF7A16]" />
                  <span className="text-[15px] font-black text-[#14295F]">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
          3. DIRECTOR
      ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */}
      <ScrollReveal>
        <section className="py-20 sm:py-28 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20">
              {/* Left */}
              <div>
                <span className="eyebrow-badge">?먯옣 吏곴컯</span>
                <h2 className="mt-5 break-keep text-[clamp(1.8rem,3.6vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">원장이 직접 수업합니다
                </h2>
                <p className="mt-5 break-keep text-[15.5px] font-semibold leading-[1.9] text-[#334e6a]">
                  ?섏뾽??諛⑺뼢, ?먮즺??諛?? ?숈깮 ?쇰뱶諛깆쓽 ?먮쫫源뚯?
                  紐⑤몢 ?먯옣??吏곸젒 ?ㅺ퀎?섍퀬 吏꾪뻾?⑸땲??
                  寃됱쑝濡쒕쭔 留롮? ?ㅻ챸???꾨땲?? ?ㅼ젣 ?깆쟻 蹂?붾줈 ?댁뼱吏????덈룄濡?
                  ?섏뾽??湲곗???遺꾨챸?섍쾶 ?몄썎?덈떎.
                </p>

                <div className="mt-8 flex flex-wrap gap-2">
                  {['吏곴컯', '吏곸젒 ?쒖옉 ?먮즺', '?숈깮蹂?蹂댁셿'].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#14295F]/14 bg-[#14295F]/5 px-4 py-1.5 text-[12.5px] font-black text-[#14295F]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right ??highlights */}
              <div className="space-y-3">
                {marketingContent.director.highlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="flex items-start gap-4 rounded-2xl border border-[rgba(20,41,95,0.18)] bg-[#14295F] px-5 py-4"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#FF7A16]" />
                    <p className="break-keep text-[14.5px] font-semibold leading-[1.72] text-white">
                      {highlight}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
          4. CAREER
      ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */}
      <ScrollReveal>
        <section className="py-20 sm:py-28" style={{ background: 'linear-gradient(180deg, #f4f7ff 0%, #ffffff 100%)' }}>
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow-badge">寃쎈젰 쨌 ?ㅼ쟻</span>
              <h2 className="mt-5 break-keep text-[clamp(1.8rem,3.6vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">원장이 직접 수업합니다
              </h2>
              <p className="mt-5 break-keep text-[15px] font-semibold leading-[1.88] text-[#334e6a]">
                ?숈깮???ㅻ옒 遊먯삩 寃쏀뿕?
                ?대뼡 吏?먯뿉???깆쟻??硫덉텛怨? ?대뵒?쒕????ㅼ떆 ?щ씪媛?붿?瑜?
                ???뺥솗?섍쾶 ?먮떒?섍쾶 ?⑸땲??
              </p>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Career items */}
              {career.map((c) => (
                <article
                  key={c.label}
                  className="rounded-[1.4rem] border border-[rgba(20,41,95,0.10)] bg-white px-6 py-7"
                  style={{ boxShadow: '0 2px 8px -2px rgba(20,41,95,0.06), 0 8px 24px -4px rgba(20,41,95,0.07)' }}
                >
                  <p className="text-[1.5rem] font-black leading-none text-[#14295F]">{c.label}</p>
                  <p className="mt-3 break-keep text-[13.5px] font-semibold leading-[1.7] text-[#445f7e]">{c.detail}</p>
                </article>
              ))}

              {/* 2026 results merged into one card */}
              <article
                className="rounded-[1.4rem] border border-[rgba(20,41,95,0.10)] bg-white px-6 py-7 sm:col-span-2 lg:col-span-3"
                style={{ boxShadow: '0 2px 8px -2px rgba(20,41,95,0.06), 0 8px 24px -4px rgba(20,41,95,0.07)' }}
              >
                <p className="mb-5 text-[10.5px] font-black uppercase tracking-[0.2em] text-[#FF7A16]">
                  2026?숇뀈???⑷꺽
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-4">
                  {results.map((r) => (
                    <div key={r.school} className="flex items-baseline gap-2">
                      <span className="text-[1.35rem] font-black text-[#14295F]">{r.count}</span>
                      <span className="text-[13px] font-semibold text-[#445f7e]">{r.school}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <article
              className="mt-8 rounded-[1.4rem] border border-[rgba(20,41,95,0.10)] bg-white px-6 py-7"
              style={{ boxShadow: '0 2px 8px -2px rgba(20,41,95,0.06), 0 8px 24px -4px rgba(20,41,95,0.07)' }}
            >
              <p className="text-[10.5px] font-black uppercase tracking-[0.2em] text-[#FF7A16]">
                ?깆쟻 ?곸듅 ?щ?
              </p>
              <h3 className="mt-3 break-keep text-[1.35rem] font-black leading-[1.3] text-[#14295F]">
                6??3?깃툒?먯꽌 ?섎뒫 諛깅텇??99源뚯?
              </h3>
              <p className="mt-2 break-keep text-[13.5px] font-semibold leading-[1.74] text-[#445f7e]">
                ?숈씪 ?숈깮??6??紐⑥쓽?됯?, 9??紐⑥쓽?됯?, ?섎뒫 ?깆쟻?쒕? 湲곗??쇰줈 ???ㅼ젣 ?곸듅 ?먮쫫?낅땲??
                媛쒖씤?뺣낫 蹂댄샇瑜??꾪빐 ?대쫫怨??숆탳 ?뺣낫??媛由?泥섎━?덉뒿?덈떎.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {['6??3?깃툒', '9??1?깃툒', '?섎뒫 諛깅텇??99'].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-[#14295F]/10 bg-[#F3F7FF] px-3 py-1.5 text-[12px] font-black text-[#14295F]"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {scoreProofCards.map((card) => (
                  <figure
                    key={card.phase}
                    className="overflow-hidden rounded-[1.1rem] border border-[rgba(20,41,95,0.12)] bg-[#F8FAFF]"
                  >
                    <img
                      src={card.image}
                      alt={`${card.phase} score proof (redacted)`}
                      className="h-[340px] w-full object-cover object-top"
                    />
                    <figcaption className="space-y-1 border-t border-[rgba(20,41,95,0.08)] bg-white px-4 py-3.5">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FF7A16]">{card.phase}</p>
                      <p className="text-[15px] font-black text-[#14295F]">{card.result}</p>
                      <p className="text-[12px] font-semibold text-[#4B6380]">{card.detail}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <div className="mt-8 rounded-[1.1rem] border border-[rgba(20,41,95,0.10)] bg-[#f8fbff] p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[12px] font-black uppercase tracking-[0.14em] text-[#FF7A16]">
                    ?깆쟻 怨듦컻 ?댄썑 移댁뭅?ㅽ넚 ?꾧린
                  </p>
                  <span className="rounded-full border border-[#14295F]/12 bg-white px-2.5 py-1 text-[11px] font-black text-[#14295F]/75">
                    ?대쫫 ?듬챸 泥섎━
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {kakaoFeedbackCards.map((card) => (
                    <figure
                      key={card.label}
                      className="overflow-hidden rounded-[0.95rem] border border-[#14295F]/10 bg-white"
                    >
                      <img
                        src={card.image}
                        alt={`${card.label} kakao feedback (redacted)`}
                        className={card.showFull ? 'block h-auto w-full' : 'h-[200px] w-full object-cover object-top'}
                      />
                      <figcaption className="space-y-1 border-t border-[#14295F]/8 px-3.5 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#FF7A16]">{card.label}</p>
                        <p className="text-[13px] font-black text-[#14295F]">{card.summary}</p>
                        {'detail' in card && card.detail && (
                          <p className="text-[11.5px] font-semibold text-[#4B6380]">{card.detail}</p>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </article>

            <p className="mx-auto mt-12 max-w-xl text-center break-keep text-[15px] font-semibold leading-[1.88] text-[#334e6a]">
              寃곌낵????踰덉쓽 ?댁씠 ?꾨땲??<br />
              ?꾩쟻???섏뾽 寃쏀뿕怨??뺥솗???쇰뱶諛?援ъ“?먯꽌 ?섏샃?덈떎.
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
          5. TEACHING METHOD
      ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */}
      <ScrollReveal>
        <section className="py-20 sm:py-28 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-xl text-center">
              <span className="eyebrow-badge">?섏뾽 諛⑹떇</span>
              <h2 className="mt-5 break-keep text-[clamp(1.8rem,3.6vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">원장이 직접 수업합니다
              </h2>
            </div>

            <StaggerChildren stagger={100} className="mt-12 grid gap-5 sm:grid-cols-2">
              {methods.map(({ icon: Icon, title, body }) => (
                <article
                  key={title}
                  className="flex gap-5 rounded-[1.4rem] border border-[rgba(20,41,95,0.09)] bg-[#f8faff] p-7"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'linear-gradient(145deg, #1e4898, #14295f)' }}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[1.05rem] font-black leading-snug text-[#14295F]">{title}</h3>
                    <p className="mt-2.5 break-keep text-[14px] font-semibold leading-[1.8] text-[#445f7e]">
                      {body}
                    </p>
                  </div>
                </article>
              ))}
            </StaggerChildren>
          </div>
        </section>
      </ScrollReveal>

      {/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
          6. MATERIALS
      ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */}
      <ScrollReveal>
        <section
          id="materials"
          className="on-dark scroll-mt-20 py-20 sm:py-28"
          style={{ background: 'linear-gradient(155deg, #080f28 0%, #0d1d47 55%, #0b1631 100%)' }}
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-xl text-center">
              <span className="eyebrow-badge-light">?섏뾽 ?먮즺</span>
              <h2 className="mt-5 break-keep text-[clamp(1.8rem,3.6vw,2.5rem)] font-black leading-[1.1] text-white">
                ?먮즺??諛?꾨뒗
                <br />
                ?섏뾽??諛?꾩? ?곌껐?⑸땲??
              </h2>
              <p className="mt-5 break-keep text-[15px] font-semibold leading-[1.88] text-white/80">
                ?몃옓??援?뼱 ?섏뾽? 吏곸젒 ?쒖옉???댁꽕 ?먮즺? ?섏뾽 ?먮즺瑜?諛뷀깢?쇰줈 吏꾪뻾?⑸땲??
                ?ㅻ챸??留롮? ?먮즺蹂대떎, ?숈깮???ㅼ젣濡??댄빐?섍퀬 ?ㅼ떆 ?곸슜?????덈뒗 ?먮즺瑜?吏?ν빀?덈떎.
              </p>
            </div>

            <StaggerChildren stagger={100} className="mt-12 grid gap-5 sm:grid-cols-3">
              {materialPreviews.map((m) => (
                <article
                  key={m.label}
                  className="rounded-[1.4rem] border px-6 py-6"
                  style={{
                    borderColor: 'rgba(255,255,255,0.10)',
                    background: 'rgba(255,255,255,0.05)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#FF9848]" />
                    <span className="text-[10px] font-black tracking-[0.16em] text-[#FFB273] uppercase">
                      {m.tag}
                    </span>
                  </div>
                  <p className="mt-4 text-[14px] font-black text-white">{m.label}</p>
                  <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.72] text-white/75">
                    {m.desc}
                  </p>
                  <div className="mt-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2">
                    <p className="text-[12px] font-bold text-white/85">{m.focus}</p>
                  </div>
                </article>
              ))}
            </StaggerChildren>

            <div className="mt-12 text-center">
              <p className="mb-6 break-keep text-[14.5px] font-semibold text-white/75">
                ?먮즺瑜??듯빐 ?섏뾽??湲곗?, ?ㅻ챸??諛?? ?뺣━ 諛⑹떇源뚯? 誘몃━ ?뺤씤?대낫?몄슂.
              </p>
              <div className="mx-auto mb-6 max-w-3xl overflow-hidden rounded-[1.2rem] border border-white/18 bg-white">
                <div className="flex items-center justify-between border-b border-[#14295F]/10 px-4 py-2.5">
                  <p className="text-[12px] font-black text-[#14295F]">PDF 1?섏씠吏 誘몃━蹂닿린</p>
                  <a href={koreanMaterialPdfPath} download className="text-[11.5px] font-black text-[#14295F]/70 hover:text-[#14295F]">
                    ?ㅼ슫濡쒕뱶
                  </a>
                </div>
                <a href={koreanMaterialPdfPath} target="_blank" rel="noreferrer" className="block bg-white">
                  <img
                    src={koreanMaterialPreviewImagePath}
                    alt="?섏뾽?먮즺 PDF 1?섏씠吏 誘몃━蹂닿린"
                    className="h-[360px] w-full object-contain"
                  />
                </a>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href={koreanMaterialPdfPath}
                  download
                  className="premium-cta premium-cta-primary inline-flex h-12 px-8 text-[14px]"
                >
                  <Download className="h-4 w-4" />
                  ?섏뾽?먮즺 PDF ?ㅼ슫濡쒕뱶
                </a>
                <a href="#class-consult" className="premium-cta premium-cta-ghost inline-flex h-12 px-8 text-[14px]">
                  ?섏뾽 ?곷떞 ?붿껌
                </a>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
          7. STUDENT FIT
      ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */}
      <ScrollReveal>
        <section className="py-20 sm:py-28" style={{ background: '#f4f7ff' }}>
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-xl text-center">
              <span className="eyebrow-badge">?섏뾽 ???/span>
              <h2 className="mt-5 break-keep text-[clamp(1.8rem,3.6vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">원장이 직접 수업합니다
              </h2>
            </div>

            <StaggerChildren stagger={90} className="mt-12 grid gap-4 sm:grid-cols-2">
              {studentFits.map((s) => (
                <article
                  key={s.title}
                  className="rounded-[1.4rem] border border-[rgba(20,41,95,0.10)] bg-white px-7 py-6"
                  style={{ boxShadow: '0 2px 8px -2px rgba(20,41,95,0.05), 0 8px 20px -4px rgba(20,41,95,0.07)' }}
                >
                  <h3 className="break-keep text-[1rem] font-black leading-[1.38] text-[#14295F]">
                    {s.title}
                  </h3>
                  <p className="mt-3 break-keep text-[13.5px] font-semibold leading-[1.78] text-[#445f7e]">
                    {s.body}
                  </p>
                </article>
              ))}
            </StaggerChildren>
          </div>
        </section>
      </ScrollReveal>

      {/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
          8. PHILOSOPHY
      ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */}
      <ScrollReveal>
        <section
          className="on-dark py-24 sm:py-36"
          style={{ background: 'linear-gradient(155deg, #0a1330 0%, #111d3f 60%, #0d1840 100%)' }}
        >
          <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="text-[10.5px] font-black tracking-[0.26em] text-[#FFB273] uppercase">
              ?섏뾽 泥좏븰
            </p>
            <h2 className="mt-6 break-keep text-[clamp(1.6rem,3.4vw,2.3rem)] font-black leading-[1.22] text-white">
              援?뼱??寃곌뎅,<br />
              ?ㅻ챸 媛?ν븳 ?ㅻ젰???섏뼱???⑸땲??
            </h2>
            <p className="mx-auto mt-8 max-w-[520px] break-keep text-[15.5px] font-semibold leading-[1.94] text-white/80">
              ???쎌뿀?ㅺ퀬 ?먮겮??寃껉낵
              ?ㅼ젣濡??ㅼ떆 ?ㅻ챸?????덈뒗 寃껋? ?ㅻ쫭?덈떎.
              ?몃옓??援?뼱 ?섏뾽? ?숈깮???ㅼ뒪濡??먮떒 湲곗????몄슦怨?
              臾몄젣瑜???대궦 ?댁쑀瑜??ㅻ챸?????덈뒗 ?곹깭源뚯? 媛??寃껋쓣 紐⑺몴濡??⑸땲??
            </p>
          </div>
        </section>
      </ScrollReveal>

      {/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
          9. CONSULT CTA
      ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */}
      <section
        id="class-consult"
        className="on-dark scroll-mt-24 py-20 sm:py-28"
        style={{ background: 'linear-gradient(160deg, #0c1a40 0%, #14295f 55%, #0d1e4a 100%)' }}
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className="overflow-hidden rounded-[2rem] border p-7 sm:p-10"
            style={{
              borderColor: 'rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 1px 0 0 rgba(255,255,255,0.08) inset, 0 32px 64px -16px rgba(0,0,0,0.32)',
            }}
          >
            {/* heading */}
            <div className="max-w-xl">
              <span className="eyebrow-badge-light">?섏뾽 ?곷떞</span>
              <h2 className="mt-5 break-keep text-[clamp(1.75rem,3.6vw,2.4rem)] font-black leading-[1.1] text-white">
                ?섏뾽???꾩슂??吏?먮???
                <br />
                ?④퍡 ?뺤씤?대낫?몄슂
              </h2>
              <p className="mt-4 break-keep text-[15px] font-semibold leading-[1.88]" style={{ color: 'rgba(255,255,255,0.72)' }}>
                ?숈깮???꾩옱 ?곹깭? ?꾩슂??諛⑺뼢??癒쇱? ?뺤씤????
                ?섏뾽??留욌뒗吏, ?대뼡 諛⑹떇???꾩슂?쒖? ?곷떞???듯빐 ?덈궡?⑸땲??
              </p>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              {/* Consult form */}
              <ConsultForm />

              {/* Contact info */}
              <div className="space-y-4">
                {contactItems.map((item) => (
                  <article
                    key={item.label}
                    className="rounded-2xl border p-5"
                    style={{
                      borderColor: 'rgba(255,255,255,0.10)',
                      background: 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <p className="text-[10.5px] font-black tracking-[0.18em] text-[#FFB273]">
                      {item.label}
                    </p>
                    <p className="mt-2 break-keep text-[1.05rem] font-black leading-relaxed text-white">
                      {item.value}
                    </p>
                  </article>
                ))}

                <div className="flex flex-wrap gap-3 pt-1">
                  <a href="#class-consult" className="premium-cta premium-cta-primary h-12 px-6 text-sm">
                    ?곷떞 ???묒꽦?섍린
                  </a>
                  <a href="/" className="premium-cta premium-cta-ghost h-12 px-6 text-sm">
                    硫붿씤?쇰줈 ?뚯븘媛湲?
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
          10. FOOTER
      ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */}
      <MarketingFooter brand={marketingContent.brand} footer={marketingContent.footer} />

      {/* Floating CTA */}
      <AcademyFloatingCTA />
    </main>
  );
}



