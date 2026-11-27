# Pixel Pet Scheduler

바탕화면을 걸어다니는 도트 캐릭터 **벌꿀오소리 릴리**가 일정·할 일·알람을 챙겨주는 Windows 데스크톱 앱입니다.

## 다운로드

**[최신 버전 받기 (Windows, zip)](https://github.com/rlawnsdusqwe-design/pixel-pet-scheduler/releases/latest/download/PixelPetScheduler-win.zip)**

1. zip을 받아 압축을 풀어요.
2. `PixelPetScheduler.exe`를 더블클릭해요. 설치는 필요 없어요.
3. 파란 "Windows의 PC 보호" 창이 뜨면 **추가 정보 → 실행**을 눌러요.

이전 버전을 쓰고 있었다면 앱을 종료하고 exe만 새 파일로 바꾸면 됩니다. 일정·할 일·꿀·레벨은 `%APPDATA%\pixel-pet-scheduler`에 따로 저장돼 그대로 이어져요.

## 기능

- **문장으로 일정 만들기**: 메모를 붙여넣으면 일정과 할 일로 정리하고, 시간이 정해지지 않은 작업은 빈 시간에 자동 배치
- **오늘 할 일**: 체크리스트, 마감일, 못 끝낸 일 다음 날로 이월
- **캘린더**: 월간·주간, 분류별 색상, 반복 일정, 크게 보기
- **알람**: 미리 알림, 알람 창과 소리, 5·10분 다시 알림
- **바탕화면 위젯**: 달력 위젯, 데일리 위젯(완료율 그래프·일정 타임라인·7일 기록)
- **집중**: 뽀모도로 타이머, 집중하는 동안 캐릭터가 옆에서 같이 공부
- **릴리**: 128px 리그 애니메이션, 행동마다 전용 모션과 표정 13가지
- **돌보기·성장**: 배부름·기분·청결·기운, 꿀 모아 음식과 액세서리 구매, 레벨업
- **미니게임**: 앱 안 간식 받기 + 바탕화면 전체에서 하는 간식 받기
- **캐릭터 편집기**: 기본 캐릭터 8종, 이미지 → 도트 변환(32/64/128), 프레임별 편집

## 직접 실행 / 빌드

[Node.js](https://nodejs.org) LTS가 필요합니다.

```bash
npm install
npm start            # 개발 실행
npm run build:win    # dist/PixelPetScheduler.exe 생성
```
