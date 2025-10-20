# 프론트엔드 연동 가이드

**버전**: 3.0
**프론트엔드 서버**: Express.js (정적 파일 서빙)
**백엔드 API**: `http://localhost:8080` (Spring Boot)
**상세 API 스펙**: [API.md](../be/API.md) 참조

---

## 목차

1. [시작하기](#1-시작하기)
2. [인증 시스템](#2-인증-시스템)
3. [페이지네이션 전략](#3-페이지네이션-전략)
4. [파일 업로드](#4-파일-업로드)
5. [입력 검증](#5-입력-검증)
6. [에러 처리](#6-에러-처리)
7. [개발 팁](#7-개발-팁)

---

## 1. 시작하기

### 1.1 프론트엔드 서버 실행

```bash
# 의존성 설치
npm install

# 개발 모드 (자동 재시작)
npm run dev

# 일반 모드
npm start
```

**접속 주소**:
- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:8080 (Spring Boot)

### 1.2 API 호출 예시

⚠️ **변경사항**: localStorage → HttpOnly Cookie 전환 완료 (2025-10-20)

```javascript
// 로그인
const response = await fetch('http://localhost:8080/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // ✅ Cookie 수신
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'Test1234!'
  })
});

const data = await response.json();
// { message: "login_success", data: { userId, email, nickname }, timestamp }
// 서버가 access_token, refresh_token Cookie 자동 설정

// 인증 API 호출
const posts = await fetch('http://localhost:8080/posts', {
  credentials: 'include'  // ✅ Cookie 자동 전송
});
```

**참조**: [PLAN.md Phase 3 - HttpOnly Cookie 전환 가이드](./PLAN.md#phase-3-jwt-httponly-cookie-전환)

### 1.3 공통 헤더

| 상황 | Content-Type | credentials |
|------|--------------|-------------|
| JSON 요청 | application/json | - |
| 인증 필요 | application/json | 'include' (Cookie 전송) |
| 파일 업로드 | multipart/form-data | 'include' (Cookie 전송) |

### 1.4 응답 구조

**성공**: `{ message, data, timestamp }` 형식
**실패**: `message` 필드에 에러 코드 반환 (예: `"AUTH-001"`)

**참조**: [API.md Section 7 - 표준 응답 형식](../be/API.md#표준-응답-형식) ⭐ **응답 구조 SSOT**

---

## 2. 인증 시스템

⚠️ **변경사항**: localStorage → HttpOnly Cookie 전환 완료 (백엔드 2025-10-20)

### 2.1 HttpOnly Cookie 방식

**백엔드 변경**:
- 서버가 로그인/회원가입 시 HttpOnly Cookie 설정 (access_token, refresh_token)
- Cookie 속성: `HttpOnly=true`, `Secure=true` (운영), `SameSite=Lax`
- JavaScript에서 토큰 접근 불가 → XSS 공격 방어

**프론트엔드 변경**:
- localStorage 저장/조회 로직 삭제
- 모든 API 호출에 `credentials: 'include'` 추가
- Authorization 헤더 제거 (Cookie 자동 전송)

**참조**: [PLAN.md Phase 3](./PLAN.md#phase-3-jwt-httponly-cookie-전환) (상세 구현 가이드)

### 2.2 토큰 갱신 자동화

`origin_source/static/js/common/api.js`에 구현된 `fetchWithAuth()` 수정 필요:

```javascript
// origin_source/static/js/common/api.js
async function fetchWithAuth(url, options = {}) {
  const config = {
    ...options,
    credentials: 'include',  // ✅ Cookie 자동 전송
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
      // Authorization 헤더 제거
    }
  };

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, config);

    // 401 Unauthorized → 토큰 갱신 후 재시도
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // 재시도 (Cookie는 자동 전송됨)
        return fetch(`${API_BASE_URL}${url}`, config);
      } else {
        // 갱신 실패 → 로그인 페이지로
        window.location.href = '/pages/user/login.html';
        throw new Error('Authentication failed');
      }
    }

    return handleResponse(response);
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// 토큰 갱신 (POST /auth/refresh_token)
async function refreshAccessToken() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh_token`, {
      method: 'POST',
      credentials: 'include'  // refresh_token Cookie 전송
    });

    if (response.ok) {
      // 서버가 새 access_token Cookie 설정
      return true;
    }
    return false;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
}
```

### 2.3 주요 API

인증 API 3개: `/auth/login`, `/auth/logout`, `/auth/refresh_token`

**참조**: [API.md Section 1 - 인증 API](../be/API.md#1-인증-authentication) ⭐ **엔드포인트 명세 SSOT**

---

## 3. 페이지네이션 전략

### 3.1 하이브리드 전략

**Cursor**: 게시글 최신순 (무한 스크롤) → `nextCursor`, `hasMore`
**Offset**: 좋아요순, 댓글 (페이지 번호) → `total_count`

⚠️ **Breaking Change**: `sort=latest`는 offset 미지원

**참조**:
- [API.md Section 3.1 - 페이지네이션 명세](../be/API.md#31-게시글-목록-조회) ⭐ **페이지네이션 SSOT**
- [LLD.md Section 7.3 - 구현 패턴](../be/LLD.md#73-페이지네이션)

### 3.2 Cursor 기반 (무한 스크롤)

**엔드포인트**: `GET /posts?sort=latest&limit=10&cursor={cursor}`

**응답 구조**: `{ posts[], nextCursor, hasMore }`

**핵심 패턴**:
- 첫 페이지: cursor 생략 (`GET /posts?sort=latest&limit=10`)
- 다음 페이지: 응답의 `nextCursor` 사용 (`GET /posts?cursor=123&limit=10`)
- 종료 조건: `nextCursor=null` 또는 `hasMore=false`
- limit+1 패턴: 서버가 11개 조회 → 10개 반환 + hasMore 판단

**참조**:
- **샘플 코드**: `origin_source/static/js/pages/board/list.js` (전체 구현)
- **응답 구조**: [API.md Section 3.1](../be/API.md#31-게시글-목록-조회)
- **서버 로직**: [LLD.md Section 7.3](../be/LLD.md#73-페이지네이션)

### 3.3 Offset 기반 (페이지 번호)

**엔드포인트**: `GET /posts?sort=likes&offset=0&limit=10`

**응답 구조**: `{ posts[], pagination: { total_count } }`

**핵심 패턴**:
- offset 계산: `(page - 1) * limit` (예: 2페이지 = offset 10)
- 페이지 수: `Math.ceil(total_count / limit)`
- 페이지 번호 네비게이션 렌더링

**참조**:
- **샘플 코드**: `origin_source/static/js/pages/board/list.js` (전체 구현)
- **응답 구조**: [API.md Section 3.1](../be/API.md#31-게시글-목록-조회)
- **적용 대상**: 좋아요순 게시글, 댓글 목록, 좋아요한 게시글 (추후 cursor 전환 예정)

---

## 4. 파일 업로드

### 4.1 Multipart 요청

**제약**: JPG/PNG/GIF, 최대 5MB

**참조**: [LLD.md Section 7.5 - 이미지 업로드 전략](../be/LLD.md#75-이미지-업로드-전략) (2가지 패턴 비교)

### 4.2 회원가입 예시

```javascript
const formData = new FormData();
formData.append('email', 'test@example.com');
formData.append('password', 'Test1234!');
formData.append('nickname', '테스트유저');
formData.append('profileImage', fileInput.files[0]);  // 선택

const response = await fetch('http://localhost:8080/users/signup', {
  method: 'POST',
  body: formData  // Content-Type 자동 설정
});
```

**에러 처리**: IMAGE-002 (파일 크기 초과), IMAGE-003 (파일 형식 오류) → [API.md](../be/API.md#image-에러-코드) 참조

### 4.3 이미지 단독 업로드 (게시글용)

```javascript
// 1단계: 이미지 업로드
const formData = new FormData();
formData.append('file', fileInput.files[0]);
const imageResponse = await fetchWithAuth('http://localhost:8080/images', {
  method: 'POST',
  body: formData
});
const { imageId } = (await imageResponse.json()).data;

// 2단계: 게시글 작성
await fetchWithAuth('http://localhost:8080/posts', {
  method: 'POST',
  body: JSON.stringify({ title, content, imageId })
});
```

**참조**: [LLD.md Section 7.5](../be/LLD.md#75-이미지-업로드-전략) (TTL 패턴 상세)

---

## 5. 입력 검증

### 5.1 필드별 제약

**주요**: 비밀번호 8-20자, 닉네임 10자, 게시글 제목 27자, 댓글 200자, 이미지 5MB

**참조**: [API.md Section 7 - 입력 검증 제약](../be/API.md#공통-에러-코드) (전체 필드 제약사항)

### 5.2 비밀번호 정책

`origin_source/static/js/common/validation.js` 참조:

```javascript
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,20}$/;

function validatePassword(password) {
  if (!PASSWORD_REGEX.test(password)) {
    return '비밀번호는 8-20자이며, 대문자, 소문자, 특수문자를 각각 1개 이상 포함해야 합니다.';
  }
  return null;
}
```

### 5.3 프론트엔드 검증 (예시)

```javascript
// 이메일
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 비밀번호 (8-20자, 대/소/특수문자)
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])\.{8,20}$/;

// 파일 (JPG/PNG/GIF, 5MB)
const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
const maxSize = 5 * 1024 * 1024;
```

**참조**: `origin_source/static/js/common/validation.js` (전체 구현)

---

## 6. 에러 처리

### 6.1 에러 코드

**형식**: `{DOMAIN}-{NUMBER}` (예: AUTH-001, USER-002, POST-001)
**총 28개**: AUTH(4), USER(7), POST(4), COMMENT(3), LIKE(2), IMAGE(3), COMMON(5)

**참조**: [API.md Section 7 - 에러 코드](../be/API.md#응답-코드) ⭐ **에러 코드 SSOT** (전체 28개 + 처리 방법)

### 6.2 에러 핸들러 구현

```javascript
const response = await fetch(url, options);
const data = await response.json();

if (!response.ok) {
  showError(translateErrorCode(data.message));  // API-001 → "잘못된 요청입니다"
  throw new Error(data.message);
}
```

**참조**: `origin_source/static/js/common/api.js::translateErrorCode()` (전체 28개 에러 코드 매핑)

### 6.3 Rate Limit (429) 재시도

```javascript
// 지수 백오프 패턴
if (response.status === 429) {
  const delay = Math.pow(2, retryCount) * 1000;  // 1초, 2초, 4초
  await new Promise(resolve => setTimeout(resolve, delay));
}
```

**참조**: [LLD.md Section 6.5 - Rate Limiting](../be/LLD.md#65-rate-limiting) (Tier 전략 상세)

---

## 7. 개발 팁

### 7.1 토큰 관리

**HttpOnly Cookie 사용**: JavaScript에서 토큰 직접 접근 불가 (XSS 방지)

**토큰 확인 방법**:
- 브라우저 개발자도구 → Application → Cookies → `http://localhost:8080`
- `access_token`, `refresh_token` Cookie 존재 확인
- Attributes: `HttpOnly`, `SameSite=Lax`, `Secure` (production)

**토큰 만료 확인**: 401 에러 발생 시 자동 갱신 (fetchWithAuth에서 처리)

### 7.2 개발 체크리스트

#### 회원가입 구현 전
- [ ] 비밀번호 정책 검증 구현
- [ ] 이메일 형식 검증
- [ ] 닉네임 길이 제한 (10자)
- [ ] 프로필 이미지 파일 검증 (5MB, JPG/PNG/GIF)

#### 게시글 목록 구현 전
- [ ] 최신순(cursor)과 좋아요순(offset) 페이지네이션 구분
- [ ] 무한 스크롤 vs 페이지 번호 UI 결정

#### 인증 구현 전
- [ ] HttpOnly Cookie 설정 확인 (서버 응답)
- [ ] credentials: 'include' 설정 (모든 인증 요청)
- [ ] 토큰 갱신 로직 구현 (fetchWithAuth)
- [ ] 401 에러 시 재로그인 플로우

### 7.3 브라우저 콘솔 테스트

```javascript
// 로그인
await fetch('http://localhost:8080/auth/login', {
  method: 'POST',
  credentials: 'include',  // ✅ Cookie 수신
  body: JSON.stringify({ email: 'test@startupcode.kr', password: 'test1234' })
});

// 토큰 확인: Application → Cookies → localhost:8080 → access_token/refresh_token

// 인증 API 호출
const posts = await fetch('http://localhost:8080/posts', {
  credentials: 'include'  // ✅ Cookie 자동 전송
}).then(r => r.json());
```

---

## FAQ

**Q1. Access Token이 만료되면?**
A1. 401 에러 발생 시 Refresh Token으로 갱신 후 재시도 (Section 2.2 참조)

**Q2. 페이지네이션 방식이 왜 두 가지?**
A2. 최신순은 무한 스크롤(cursor), 좋아요순은 페이지 번호(offset) 필요 (Section 3 참조)

**Q3. 회원가입 시 이미지 필수?**
A3. 선택 사항. `profileImage` 생략 가능

**Q4. Rate Limit에 걸리면?**
A4. 429 응답 시 1-2초 대기 후 재시도 (Section 6.3 참조)

**Q5. 프론트엔드 서버 포트 변경?**
A5. `PORT=8000 npm start` 또는 `.env` 파일 수정

---

## 참고 문서

### 백엔드 문서 (Single Source of Truth)
- **⭐ [API.md](../be/API.md)**: REST API 명세 (21개 엔드포인트, 28개 에러 코드) - **에러 코드 SSOT**
- **⭐ [LLD.md](../be/LLD.md)**: 백엔드 아키텍처 및 설계 결정사항 - **구현 패턴 SSOT**
- **[DDL.md](../be/DDL.md)**: 데이터베이스 스키마

### 프론트엔드 문서
- **[claude-frontend-guide.md](./claude-frontend-guide.md)**: 프론트엔드 개발 원칙 (가독성, 응집도, 결합도)

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|-----------|
| 2025-10-16 | 1.0 | 프론트엔드 연동 가이드 작성 (간소화) |
| 2025-10-20 | 2.0 | Express.js 정적 파일 서버로 업데이트 (Vanilla JS) |
| 2025-10-20 | 3.1 | 코드 예제 간소화 (482줄 → 435줄, 10% 감소) - 핵심 스니펫만 유지 |
| 2025-10-20 | 2.1 | 중복 제거 (API.md/LLD.md 참조 방식) - 40-55% → <20% |
| 2025-10-20 | 3.0 | HttpOnly Cookie 전환 완료 (localStorage → credentials: 'include'), 페이지네이션 코드 중복 제거 (70줄 → 32줄) |
