# CLAUDE.md

# Project Documentation (Auto-loaded)
@docs/fe/claude-frontend-guide.md
@docs/fe/FRONTEND_GUIDE.md
@docs/be/API.md

---

## 프로젝트 개요

**프로젝트명**: DC2 - 개발자 커뮤니티 플랫폼 (프론트엔드)
**프로젝트 구조**: 멀티레포 (프론트엔드/백엔드 분리)
**프로젝트 목적**: 기존 Spring Boot SSR 방식을 Express.js 정적 파일 서빙으로 분리
**현재 상태**: `origin_source/` 디렉토리의 Vanilla JS 정적 파일, Express.js 서버 설정 완료
**인증 방식**: HttpOnly Cookie (토큰) + localStorage (userId)

**레포지토리 구성 (멀티레포)**:
- **프론트엔드 레포**: https://github.com/WAFriend3416/waf-3-community-fe (현재 프로젝트)
  - 로컬 위치: `/Users/jsh/ktb_community_fe`
  - Express.js 정적 파일 서버, Vanilla JS/HTML/CSS

- **백엔드 레포**: `/Users/jsh/IdeaProjects/community` (별도 프로젝트)
  - Spring Boot 3.5.6, Java 24
  - REST API, MySQL, AWS S3

---

## 시스템 아키텍처 (멀티레포)

```
프론트엔드 레포 (waf-3-community-fe)
┌──────────────────────────────────┐
│ Express.js (localhost:3000)      │
│ - 정적 파일 서빙                   │
│ - Vanilla JS/HTML/CSS            │
└──────────────────────────────────┘
           │
           │ REST API (HttpOnly Cookie ✅)
           ↓
백엔드 레포 (community)
┌──────────────────────────────────┐
│ Spring Boot (localhost:8080)     │
│ - REST API, 인증                  │
│ - MySQL, AWS S3                  │
└──────────────────────────────────┘
```

**핵심 포인트**:
- 멀티레포: 프론트엔드/백엔드 독립 개발 및 배포
- Express.js: 정적 파일만 서빙 (SSR 대체)
- Spring Boot: 비즈니스 로직, 데이터베이스, 인증

---

## 프로젝트 맥락

**현재 프로젝트 구성 (프론트엔드 레포)**:
- **정적 자산**: `origin_source/` (Vanilla JS, HTML, CSS)
- **API 문서**: `docs/be/API.md` (백엔드 API 명세 복사본)
- **백엔드 설계**: `docs/be/LLD.md` (참조용 문서)
- **프론트엔드 가이드**: `docs/fe/` (개발 원칙, API 연동)

**백엔드 레포 위치**: `/Users/jsh/IdeaProjects/community`

**현재 프론트엔드 기술 스택**:
- Vanilla JavaScript (빌드 시스템 없음)
- JWT 인증 (HttpOnly Cookie)
- Spring Boot 백엔드와 REST API 통신
- 컴포넌트 기반 구조의 정적 HTML 페이지

---

## 디렉토리 구조

**참조**: [claude-frontend-guide.md Section 3.1](docs/fe/claude-frontend-guide.md#31-컴포넌트별-파일-구성) (전체 디렉토리 구조 및 파일 조직)

---

## 핵심 아키텍처 및 패턴

### 인증 시스템

- JWT 기반 (Access: 15분, Refresh: 7일)
- HttpOnly Cookie 방식 (XSS 방지)
- userId는 localStorage 저장 (UI용)
- 401 에러 시 자동 토큰 갱신

**참조**:
- 상세 구현: [FRONTEND_GUIDE.md Section 2](docs/fe/FRONTEND_GUIDE.md#2-인증-시스템)
- API 명세: [API.md Section 1](docs/be/API.md#1-인증-authentication)

### API 통신 패턴

**Base URL**: `http://localhost:8080` (Spring Boot 백엔드)

**표준 응답 구조**: `{ message, data, timestamp }` 형식 - **참조**: [API.md Section 7](docs/be/API.md#7-공통-사양) ⭐ **응답 형식 SSOT**

### 페이지네이션 전략

- **Cursor 기반** (최신순): 무한 스크롤
- **Offset 기반** (좋아요순, 댓글): 페이지 번호

**참조**: [FRONTEND_GUIDE.md Section 3](docs/fe/FRONTEND_GUIDE.md#3-페이지네이션-전략) (하이브리드 전략 상세)

### 에러 처리

**28개 에러 코드**를 도메인별로 분류 (AUTH, USER, POST, COMMENT, LIKE, IMAGE, COMMON)

**참조**: [API.md Section 7](docs/be/API.md#응답-코드) ⭐ **에러 코드 SSOT**

### 컴포넌트 기반 구조

**참조**: [claude-frontend-guide.md Section 3](docs/fe/claude-frontend-guide.md#3-응집도-cohesion) (HTML 조각, CSS 아키텍처, JavaScript 구조)

---

## 개발 가이드라인

### 프론트엔드 개발 원칙

**4가지 핵심 원칙**:
1. **가독성**: 코드가 위에서 아래로 자연스럽게 읽힘
2. **예측 가능성**: 서버 렌더링과 클라이언트 동작의 명확한 구분
3. **응집도**: 관련된 템플릿/스타일/스크립트를 함께 관리
4. **결합도**: JavaScript가 DOM 구조에 최소한으로 의존 (`data-*` 속성 사용)

**참조**: [claude-frontend-guide.md](docs/fe/claude-frontend-guide.md) (상세 가이드라인, 코드 예시, 체크리스트)

### API 연동

**공통 유틸리티**: `origin_source/static/js/common/` (api.js, utils.js, validation.js)

**참조**: [FRONTEND_GUIDE.md](docs/fe/FRONTEND_GUIDE.md) (전체 API 연동 가이드)

### 명명 규칙

**CSS BEM 스타일**: `.card`, `.card__title`, `.card--featured`
**JavaScript**: camelCase (함수), UPPER_SNAKE_CASE (상수), 언더스코어 시작 (private)

---

## API 레퍼런스

**26개 엔드포인트**를 7개 카테고리로 분류:

| 카테고리 | 엔드포인트 수 | 주요 API |
|---------|--------------|----------|
| **인증** | 4개 | POST /auth/login, /logout, /refresh_token, GET /auth/guest-token |
| **사용자** | 5개 | POST /users/signup, GET/PATCH /users/{id}, 비밀번호 변경, 탈퇴 |
| **게시글** | 5개 | GET /posts (cursor/offset), POST/PATCH/DELETE |
| **이미지** | 3개 | POST /images, /images/metadata, GET /images/presigned-url |
| **댓글** | 4개 | GET/POST/PATCH/DELETE /posts/{id}/comments |
| **좋아요** | 3개 | POST/DELETE /posts/{id}/like, GET /posts/users/me/likes |
| **시스템** | 2개 | GET /health, /stats |

**참조**: [API.md](docs/be/API.md) ⭐ **전체 API 명세 SSOT**

---

## 데이터베이스 스키마

**MySQL 8.0+** 테이블:
- `users`: 사용자 계정 (email, password_hash, nickname, role, user_status)
- `posts`: 게시글 (post_title, post_content, post_status)
- `comments`: 댓글
- `post_likes`: M:N 관계 (user_id + post_id unique)
- `post_stats`: 비정규화된 통계 (view_count, like_count, comment_count)
- `images`: S3 이미지 메타데이터 (image_url, expires_at for TTL)
- `post_images`: 게시글-이미지 M:N 관계
- `user_tokens`: Refresh Token 저장소

**주요 설계 패턴**:
- Soft delete: `user_status`, `post_status`, `comment_status` enum
- Optimistic update: 조회수는 DB에서 증가시키지만 이전 값 반환 (클라이언트에서 UI에 +1)
- Atomic update: 좋아요/댓글 수는 직접 SQL UPDATE로 race condition 방지

**참조**: [LLD.md Section 4](docs/be/LLD.md#4-데이터베이스-설계)

---

## 주요 제약사항

### 입력 검증

**주요 제약**: 비밀번호 8-20자, 닉네임 10자, 게시글 제목 27자, 댓글 200자, 이미지 5MB

**참조**: [FRONTEND_GUIDE.md Section 5](docs/fe/FRONTEND_GUIDE.md#5-입력-검증) (전체 필드 제약사항 및 검증 로직)

### Rate Limiting

**참조**: [LLD.md Section 6.5](docs/be/LLD.md#65-rate-limiting) (3단계 Tier 전략 상세)

---

## 일반적인 개발 작업

### 프론트엔드 서버 실행

**사전 요구사항**: `localhost:8080`에서 Spring Boot 백엔드 서버 실행 중

```bash
# Express.js 정적 파일 서버 실행 (권장)
npm install
npm run dev   # 개발 모드 (자동 재시작)
# 또는
npm start     # 일반 모드

# 접속: http://localhost:3000/pages/user/login.html
```

**대안 (Python):**
```bash
python3 -m http.server 8000
# 접속: http://localhost:8000/pages/user/login.html
```

### API 호출 테스트

**참조**: [FRONTEND_GUIDE.md Section 7.3](docs/fe/FRONTEND_GUIDE.md#73-브라우저-콘솔-테스트) (브라우저 콘솔 테스트 예시)

### 일반적인 문제

**CORS 에러**: 백엔드 CORS 설정에 프론트엔드 URL 추가
**401 Unauthorized**: Chrome DevTools → Application → Cookies → `localhost:8080`에서 `access_token`, `refresh_token` 존재 확인
**이미지 업로드 실패**: 파일 크기(5MB), 타입(JPG/PNG/GIF), 백엔드 S3 자격증명 확인

---

## 참고할 중요 파일

### 인증 작업 시
- `origin_source/static/js/common/api.js`: JWT 로직
- [API.md Section 1](docs/be/API.md#1-인증-authentication): 인증 엔드포인트 명세

### 게시글/댓글 작업 시
- `origin_source/static/js/pages/board/*.js`: 게시글 로직
- [API.md Section 3, 5](docs/be/API.md#3-게시글-posts): 게시글/댓글 명세

### 페이지네이션 작업 시
- [API.md Section 3.1](docs/be/API.md#31-게시글-목록-조회): 하이브리드 페이지네이션 설명
- [FRONTEND_GUIDE.md Section 3](docs/fe/FRONTEND_GUIDE.md#3-페이지네이션-전략): 클라이언트 구현 예시

### 파일 업로드 작업 시
- `origin_source/static/js/common/api.js::uploadImage()`
- [API.md Section 4](docs/be/API.md#4-이미지-images): 이미지 업로드 명세

---

## Git 워크플로우 (멀티레포)

**프론트엔드 레포**:
- origin: `https://github.com/WAFriend3416/waf-3-community-fe.git`
- upstream: `https://github.com/100-hours-a-week/waf-3-community-fe.git`
- 브랜치: `main`

**백엔드 레포**: `/Users/jsh/IdeaProjects/community` (별도 관리)

**커밋 메시지 규칙**:
- `feat: 사용자 프로필 편집 추가`
- `fix: 토큰 갱신 무한 루프 해결`
- `refactor: 검증 로직을 별도 파일로 분리`
- `docs: API.md 업데이트 (백엔드 변경사항 반영)`
- `sync: 백엔드 API 변경사항 프론트엔드 동기화` ← 멀티레포 동기화 커밋

**커밋 전 확인사항**:
- console.log 구문 제거
- 하드코딩된 자격증명이 없는지 확인
- Chrome과 Safari 모두에서 테스트 (해당되는 경우)
- 백엔드 API 변경 시 docs/be/API.md 동기화 확인

---

## 참고 문서

### 내부 문서 (Single Source of Truth)
- **⭐ [API.md](docs/be/API.md)**: REST API 명세 (21개 엔드포인트, 28개 에러 코드) - **에러 코드 SSOT**
- [DDL.md](docs/be/DDL.md): 데이터베이스 스키마 및 인덱스
- [claude-frontend-guide.md](docs/fe/claude-frontend-guide.md): 프론트엔드 개발 원칙 (가독성, 응집도, 결합도)
- [FRONTEND_GUIDE.md](docs/fe/FRONTEND_GUIDE.md): API 연동 패턴과 페이지네이션

### 외부 리소스
- Express.js: https://expressjs.com
- Spring Boot: https://spring.io/projects/spring-boot
- MySQL: https://dev.mysql.com/doc/

---