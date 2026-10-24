# BTC 진입 레이더

비트코인 진입 타이밍을 한 화면에서 보는 넷리파이 웹앱이에요. 주소는 https://btc-entry-radar.netlify.app 이에요.

- **판정**: 사이클 바닥 점수와 추세 전환 점수를 합쳐서 대기 · 추세 추종 · 적립 · 정찰병 · 본진입 다섯 단계로 나눠요.
- **돌파 신호**: 업비트 원화 일봉 기준으로 신고가 돌파를 보고, 큰 흐름(월봉 상승 중이거나 레이더가 대기가 아닐 때)까지 확인해요. 매일 오전 9시 일봉이 끝날 때 판정해요.
- **그 밖의 카드**: 실시간 차트, 김치 프리미엄, 스테이블코인, 사이클 비교, 선물 포지션, 매크로, 가격 사다리, 백테스트, 일정이 있어요.

## 구조
```
public/
  index.html            화면 전체 (당근 SEED 디자인 토큰)
  breakout.js           돌파 신호 엔진 (브라우저·node 공용, 백테스트와 같은 규칙)
  backtest.json         레이더 판정 과거 기록·단계별 성과
  onchain.json          온체인 기준값 예비본 (/api/onchain 이 안 될 때)
  icon.svg, *.png, favicon.ico, manifest.webmanifest   앱 아이콘
netlify/functions/
  onchain.mts   /api/onchain   매일 아침 예약 작업이 값을 올리고(POST, 토큰 필요) 화면이 읽어요(GET). Netlify Blobs 저장
  mvrv.mts      /api/mvrv      CoinMetrics 데이터로 MVRV Z 직접 계산
  macro.mts     /api/macro     FRED 달러·미 10년물·나스닥
  derivs.mts    /api/derivs    OKX 선물 통계 중계
  upbit.mts     /api/upbit-*   업비트 호출 제한에 걸릴 때 쓰는 대체 경로
```

## 배포
이 레포의 `main` 브랜치에 푸시하면 넷리파이가 자동으로 배포해요. 빌드 명령은 없고, 게시 폴더는 `public` 이에요(`netlify.toml`).
`ONCHAIN_TOKEN` 환경 변수는 넷리파이 사이트 설정에만 있어요. 레포에는 넣지 않아요.

_자동 배포 연결 확인: 2026-10-24_
