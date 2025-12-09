# DC2 커뮤니티 플랫폼 - 프론트엔드

카카오테크 부트캠프 3기 클라우드 네이티브 과정 - 개인 프로젝트  
(D)개발자 (C)커뮤니티 (C)클럽(DC2) 웹 애플리케이션의 프론트엔드 레포지토리입니다.

![Demo](docs/images/indexPage.png)


## 데모

**서비스 URL**: https://community.ktb-waf.cloud

## 데모 영상

![Demo](docs/videos/demo.gif)

## 관련 레포지토리

**백엔드**: [3-waf-jung-community-BE](https://github.com/100-hours-a-week/3-waf-jung-community-BE)

## 기술 스택

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Server**: Express.js
- **Infrastructure**: AWS (ALB, EC2, ECR, S3, RDS)
- **CI/CD**: GitHub Actions + Jenkins
- **Authentication**: JWT

## 시작하기

### 사전 요구사항
- Node.js 18 이상
- 백엔드 서버 실행 중 (http://localhost:8080)

### 설치
```bash
git clone https://github.com/WAFriend3416/waf-3-community-fe.git
cd waf-3-community-fe
npm install
```

### 환경 변수 설정
```bash
# .env 파일 생성
BACKEND_URL=http://localhost:8080  # 백엔드 API URL
API_PREFIX=/api/v1                 # ALB 경로 prefix (프로덕션)
```

### 실행
```bash
# 개발 모드 (자동 재시작)
npm run dev

# 일반 모드
npm start
```

**접속**: http://localhost:3000

## 프로젝트 구조

```
origin_source/static/
├── css/
│   ├── common/         # 공통 스타일 (reset, layout, variables)
│   ├── components/     # 컴포넌트 스타일 (button, card, header)
│   └── pages/          # 페이지별 스타일
├── js/
│   ├── common/         # 공통 유틸 (api, validation, toast)
│   └── pages/          # 페이지별 로직
│       ├── board/      # 게시판 (list, detail, write, edit)
│       └── user/       # 사용자 (login, register, profile)
└── pages/
    ├── board/          # 게시판 HTML
    ├── user/           # 사용자 HTML
    └── fragments/      # 재사용 HTML 조각 (header, modal)
```
