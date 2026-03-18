<?php get_header(); ?>
<section class="hero">
  <div class="container hero-inner">
    <p class="eyebrow">트랙 국어 학원 | 트랙 관리형 스터디카페</p>
    <h1>국어 성적 향상과 몰입 학습을 함께 만드는 트랙 학습 시스템</h1>
    <p class="hero-copy">
      트랙 국어 학원의 체계적인 국어 커리큘럼과 트랙 관리형 스터디카페의 집중 환경을 한 곳에서 제공합니다.
      목표 설정부터 성적 향상까지, 학생별 맞춤 코칭으로 끝까지 함께합니다.
    </p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="#contact">무료 상담 신청</a>
      <a class="btn btn-ghost" href="#programs">프로그램 보기</a>
    </div>
  </div>
</section>

<section id="about" class="section">
  <div class="container two-col">
    <div>
      <p class="section-label">학원 소개</p>
      <h2>트랙 국어 학원의 학생 맞춤 국어 입시 전략</h2>
      <p>
        국어 전임 강사진, 주간 성취 리포트, 학부모 피드백 시스템을 통해
        학습 공백 없이 실력을 누적합니다.
      </p>
      <ul class="bullet-list">
        <li>1:1 학습 진단 및 플래닝</li>
        <li>소수 정예 반 운영</li>
        <li>내신/수능 통합 관리</li>
      </ul>
    </div>
    <div class="panel highlight">
      <h3>빠른 지표 확인</h3>
      <div class="stats-grid">
        <div><strong>92%</strong><span>성적 향상 체감</span></div>
        <div><strong>1:4</strong><span>튜터 대 학생 비율</span></div>
        <div><strong>365일</strong><span>자습실 운영</span></div>
        <div><strong>24h</strong><span>질문 대응 시스템</span></div>
      </div>
    </div>
  </div>
</section>

<section id="programs" class="section section-soft">
  <div class="container">
    <p class="section-label">프로그램</p>
    <h2>목표와 학년에 맞는 학습 프로그램</h2>
    <div class="card-grid">
      <article class="card">
        <h3>중등 심화 과정</h3>
        <p>개념 완성 + 사고력 확장 중심으로 고등 과정 선행 기반을 만듭니다.</p>
      </article>
      <article class="card">
        <h3>고등 내신 집중반</h3>
        <p>학교별 기출 분석과 서술형 대비를 통해 등급 상승을 집중 지원합니다.</p>
      </article>
      <article class="card">
        <h3>수능 파이널 캠프</h3>
        <p>실전 모의고사와 오답 클리닉으로 마지막 성적 점프를 설계합니다.</p>
      </article>
    </div>
  </div>
</section>

<section id="cafe" class="section">
  <div class="container two-col reverse">
    <div class="panel cafe-panel">
      <h3>스터디카페 환경</h3>
      <ul class="bullet-list">
        <li>개인 집중석 / 오픈형 좌석 분리 운영</li>
        <li>무소음 키보드존 및 백색소음 시스템</li>
        <li>좌석 예약, 출결, 학습 시간 통계 제공</li>
      </ul>
    </div>
    <div>
      <p class="section-label">트랙 관리형 스터디카페 소개</p>
      <h2>오래 앉아도 흐트러지지 않는 몰입 설계</h2>
      <p>
        조명, 좌석, 동선까지 학습 효율 중심으로 설계했습니다.
        혼자 공부해도 루틴이 유지되도록 관리 시스템을 함께 제공합니다.
      </p>
      <a class="text-link" href="#contact">시설 투어 예약하기</a>
    </div>
  </div>
</section>

<section id="reviews" class="section section-soft">
  <div class="container">
    <p class="section-label">수강 후기</p>
    <h2>학생과 학부모가 말하는 변화</h2>
    <div class="review-grid">
      <blockquote>
        "학습 계획이 구체적이라 흔들릴 때마다 다시 중심을 잡을 수 있었어요."
        <cite>고2 학생</cite>
      </blockquote>
      <blockquote>
        "스터디카페 출결 기록 덕분에 생활 루틴이 눈에 띄게 안정됐습니다."
        <cite>학부모</cite>
      </blockquote>
      <blockquote>
        "마지막 두 달 파이널 관리가 특히 좋았습니다. 실전 감각이 올라갔어요."
        <cite>재수생</cite>
      </blockquote>
    </div>
  </div>
</section>

<section id="contact" class="section contact">
  <div class="container contact-box">
    <div>
      <p class="section-label">상담 문의</p>
      <h2>방문 상담 또는 전화 상담을 예약하세요</h2>
      <p>희망 학년, 과목, 목표를 남겨주시면 맞춤 상담으로 안내드립니다.</p>
    </div>
    <form class="contact-form" action="#" method="post">
      <label>
        이름
        <input type="text" name="name" placeholder="홍길동" required />
      </label>
      <label>
        연락처
        <input type="tel" name="phone" placeholder="010-0000-0000" required />
      </label>
      <label>
        문의 내용
        <textarea name="message" rows="4" placeholder="학년, 목표, 상담 희망 시간"></textarea>
      </label>
      <button type="submit" class="btn btn-primary">상담 신청 보내기</button>
    </form>
  </div>
</section>
<?php get_footer(); ?>
