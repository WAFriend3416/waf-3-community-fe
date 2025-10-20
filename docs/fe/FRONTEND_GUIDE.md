# 프론트엔드 연동 가이드

**버전**: 2.0
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

```javascript
// 로그인
const response = await fetch('http://localhost:8080/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'Test1234!'
  })
});

const data = await response.json();
// { message: "login_success", data: { access_token, refresh_token }, timestamp }

// 토큰 저장
localStorage.setItem('access_token', data.data.access_token);
localStorage.setItem('refresh_token', data.data.refresh_token);

// 인증 API 호출
const posts = await fetch('http://localhost:8080/posts', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
});
```

### 1.3 공통 헤더

| 상황 | Content-Type | Authorization |
|------|--------------|---------------|
| JSON 요청 | application/json | - |
| 인증 필요 | application/json | Bearer {token} |
| 파일 업로드 | multipart/form-data | Bearer {token} |

### 1.4 응답 구조

**성공**: `{ message, data, timestamp }` 형식
**실패**: `message` 필드에 에러 코드 반환 (예: `"AUTH-001"`)

**참조**: [API.md Section 7 - 표준 응답 형식](../be/API.md#표준-응답-형식) ⭐ **응답 구조 SSOT**

---

## 2. 인증 시스템

### 2.1 토큰 관리

**토큰 종류**:
- **Access Token**: 30분, API 요청 시 사용
- **Refresh Token**: 7일, Access Token 갱신용

**발급 시점**: 회원가입(`POST /users/signup`), 로그인(`POST /auth/login`)

### 2.2 토큰 갱신 자동화

`origin_source/static/js/common/api.js`에 구현된 `fetchWithAuth()` 사용:

```javascript
// origin_source/static/js/common/api.js에서
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('access_token');

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token && { Authorization: `Bearer ${token}` })
    }
  };

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, config);

    // 401 Unauthorized → 토큰 갱신 후 재시도
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // 재시도
        const newToken = localStorage.getItem('access_token');
        config.headers.Authorization = `Bearer ${newToken}`;
        const retryResponse = await fetch(`${API_BASE_URL}${url}`, config);
        return handleResponse(retryResponse);
      } else {
        // 갱신 실패 → 로그인 페이지로
        logout();
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

**Vanilla JS 구현 예시**:
```javascript
// origin_source/static/js/pages/board/list.js
(function() {
  let cursor = null;
  let hasMore = true;

  async function loadMore() {
    if (!hasMore) return;

    const url = cursor
      ? `http://localhost:8080/posts?sort=latest&limit=10&cursor=${cursor}`
      : 'http://localhost:8080/posts?sort=latest&limit=10';

    const response = await fetch(url);
    const data = await response.json();

    renderPosts(data.data.posts); // 기존 목록에 추가
    cursor = data.data.nextCursor;
    hasMore = data.data.hasMore;

    // 더보기 버튼 업데이트
    document.querySelector('[data-load-more]').style.display =
      hasMore ? 'block' : 'none';
  }

  // 더보기 버튼 클릭
  document.querySelector('[data-load-more]')?.addEventListener('click', loadMore);

  // 초기 로드
  loadMore();
})();
```

**핵심**: `nextCursor=null` 또는 `hasMore=false`면 마지막 페이지

### 3.3 Offset 기반 (페이지 번호)

**엔드포인트**: `GET /posts?sort=likes&offset=0&limit=10`

**Vanilla JS 구현 예시**:
```javascript
let currentPage = 1;
const limit = 10;

async function loadPage(page) {
  const offset = (page - 1) * limit;
  const response = await fetch(
    `http://localhost:8080/posts?sort=likes&offset=${offset}&limit=${limit}`
  );
  const data = await response.json();

  renderPosts(data.data.posts);
  renderPagination(data.data.pagination.total_count, page, limit);
}

function renderPagination(totalCount, currentPage, limit) {
  const totalPages = Math.ceil(totalCount / limit);
  const pagination = document.querySelector('[data-pagination]');

  pagination.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = i === currentPage ? 'active' : '';
    btn.addEventListener('click', () => loadPage(i));
    pagination.appendChild(btn);
  }
}
```

**핵심**: `total_count` 제공으로 페이지 번호 계산 가능

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

// 프로필 이미지 (선택)
const fileInput = document.querySelector('[data-profile-image]');
if (fileInput.files[0]) {
  formData.append('profileImage', fileInput.files[0]);
}

const response = await fetch('http://localhost:8080/users/signup', {
  method: 'POST',
  body: formData  // Content-Type 자동 설정
});

// 에러 처리
if (!response.ok) {
  const error = await response.json();

  if (error.message === 'IMAGE-002') {
    alert('파일 크기는 5MB 이하여야 합니다.');
  } else if (error.message === 'IMAGE-003') {
    alert('JPG, PNG, GIF 파일만 업로드 가능합니다.');
  }
}
```

### 4.3 이미지 단독 업로드 (게시글용)

```javascript
// 1단계: 이미지 업로드
const formData = new FormData();
const fileInput = document.querySelector('[data-post-image]');
formData.append('file', fileInput.files[0]);

const imageResponse = await fetchWithAuth('http://localhost:8080/images', {
  method: 'POST',
  body: formData
});

const imageData = await imageResponse.json();
const { imageId, imageUrl } = imageData.data;

// 2단계: 게시글 작성 시 imageId 사용
const postResponse = await fetchWithAuth('http://localhost:8080/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: '게시글 제목',
    content: '게시글 내용',
    imageId: imageId  // 업로드된 이미지 ID
  })
});
```

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

### 5.3 프론트엔드 검증 함수

```javascript
function validateSignupForm(formData) {
  const errors = {};

  // 이메일
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email)) {
    errors.email = '유효한 이메일 주소를 입력하세요.';
  }

  // 비밀번호
  const passwordError = validatePassword(formData.password);
  if (passwordError) errors.password = passwordError;

  // 닉네임
  if (formData.nickname.length > 10) {
    errors.nickname = '닉네임은 최대 10자입니다.';
  }

  // 파일
  if (formData.profileImage) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(formData.profileImage.type)) {
      errors.profileImage = 'JPG, PNG, GIF 파일만 가능합니다.';
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (formData.profileImage.size > maxSize) {
      errors.profileImage = '파일 크기는 5MB 이하여야 합니다.';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
```

---

## 6. 에러 처리

### 6.1 에러 코드

**형식**: `{DOMAIN}-{NUMBER}` (예: AUTH-001, USER-002, POST-001)
**총 28개**: AUTH(4), USER(7), POST(4), COMMENT(3), LIKE(2), IMAGE(3), COMMON(5)

**참조**: [API.md Section 7 - 에러 코드](../be/API.md#응답-코드) ⭐ **에러 코드 SSOT** (전체 28개 + 처리 방법)

### 6.2 에러 핸들러 구현

`origin_source/static/js/common/api.js`의 `translateErrorCode()` 사용:

```javascript
async function handleApiRequest(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      const errorMessage = translateErrorCode(data.message);
      showError(errorMessage);
      throw new Error(data.message);
    }

    return data;
  } catch (error) {
    console.error('API 요청 실패:', error);
    throw error;
  }
}
```

### 6.3 Rate Limit (429) 재시도

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const delay = Math.pow(2, i) * 1000; // 1초, 2초, 4초
      console.log(`Rate limited. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    return response;
  }
}
```

---

## 7. 개발 팁

### 7.1 JWT 디코딩

```javascript
// Access Token 디코딩 (만료 시간 확인)
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

const token = localStorage.getItem('access_token');
const payload = parseJwt(token);
console.log('Token expires at:', new Date(payload.exp * 1000));
```

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
- [ ] Access Token localStorage 저장
- [ ] 토큰 갱신 로직 구현 (fetchWithAuth)
- [ ] 401 에러 시 재로그인 플로우

### 7.3 브라우저 콘솔 테스트

```javascript
// 로그인 테스트
const response = await fetch('http://localhost:8080/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@startupcode.kr',
    password: 'test1234'
  })
});
const data = await response.json();

// 토큰 저장
localStorage.setItem('access_token', data.data.access_token);
localStorage.setItem('refresh_token', data.data.refresh_token);

// 인증 API 테스트
const posts = await fetchWithAuth('http://localhost:8080/posts');
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
| 2025-10-20 | 2.1 | 중복 제거 (API.md/LLD.md 참조 방식) - 40-55% → <20% |
