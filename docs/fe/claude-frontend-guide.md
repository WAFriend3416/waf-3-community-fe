# Claude Code 프론트엔드 개발 지침서 (Vanilla JS + HTML + CSS)

## 핵심 원칙
Vanilla JavaScript, HTML, CSS로 작성되는 프론트엔드 코드는 **변경하기 쉬운 코드**를 목표로 작성한다. 4가지 기준(가독성, 예측 가능성, 응집도, 결합도)을 기반으로 판단한다.

---

## 1. 가독성 (Readability)

### 원칙
HTML과 JavaScript 코드 모두 위에서 아래로 자연스럽게 읽혀야 하며, 구조와 동작을 명확히 구분한다.

### 실무 가이드라인

#### 1.1 HTML 구조화
```html
<!-- ❌ Bad - 복잡한 인라인 스타일과 이벤트 -->
<div class="user-card" style="display: flex; padding: 20px;" onclick="handleClick(123, 'ACTIVE', 'ADMIN')">
  <span style="font-weight: bold;">User Name</span>
</div>

<!-- ✅ Good - 클래스와 데이터 속성 활용 -->
<div class="user-card" data-user-id="123" data-status="ACTIVE" data-role="ADMIN">
  <span class="user-card__name">User Name</span>
</div>
```

#### 1.2 JavaScript 모듈화
```javascript
// ❌ Bad - 전역 스코프 오염
var userList = [];
function addUser() { ... }
function deleteUser() { ... }

// ✅ Good - IIFE 패턴으로 캡슐화
const UserManager = (function() {
  let userList = [];

  function addUser(user) { ... }
  function deleteUser(id) { ... }

  return {
    add: addUser,
    delete: deleteUser
  };
})();
```

#### 1.3 HTML Fragment 재사용
```html
<!-- ❌ Bad - 중복된 구조 -->
<div class="card">
  <h3 class="card__title">Title 1</h3>
  <p class="card__description">Description 1</p>
</div>
<div class="card">
  <h3 class="card__title">Title 2</h3>
  <p class="card__description">Description 2</p>
</div>

<!-- ✅ Good - JavaScript로 템플릿 생성 -->
<div id="card-container"></div>

<script>
function createCard(title, description) {
  return `
    <div class="card">
      <h3 class="card__title">${escapeHtml(title)}</h3>
      <p class="card__description">${escapeHtml(description)}</p>
    </div>
  `;
}

const container = document.getElementById('card-container');
container.innerHTML = createCard('Title 1', 'Description 1') +
                      createCard('Title 2', 'Description 2');
</script>
```

---

## 2. 예측 가능성 (Predictability)

### 원칙
정적 HTML과 동적 JavaScript 동작을 명확히 구분한다.

### 실무 가이드라인

#### 2.1 데이터 속성 활용
```html
<!-- ❌ Bad - JavaScript에서 텍스트 파싱 -->
<button onclick="deleteUser(this.innerText.split('-')[1])">
  Delete User-123
</button>

<!-- ✅ Good - data 속성 사용 -->
<button data-action="delete" data-user-id="123">
  Delete User
</button>
```

#### 2.2 이벤트 핸들링 일관성
```javascript
// ❌ Bad - 혼재된 이벤트 바인딩
<button onclick="handleClick()">Click 1</button>
<button id="btn2">Click 2</button>
<script>
  document.getElementById('btn2').onclick = function() { ... }
</script>

// ✅ Good - 일관된 방식 (addEventListener 권장)
<button data-action="delete" data-id="123">Delete</button>
<script>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', handleDelete);
  });
});
</script>
```

#### 2.3 AJAX 응답 표준화
```javascript
// ❌ Bad - 일관성 없는 응답 처리
function saveUser(userData) {
  fetch('/api/users', {...})
    .then(res => res.json())
    .then(data => {
      if(data) location.reload(); // 어떤 데이터?
    });
}

// ✅ Good - 표준화된 응답 처리 (ApiResponse 형식)
function saveUser(userData) {
  fetch('http://localhost:8080/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    },
    body: JSON.stringify(userData)
  })
  .then(res => res.json())
  .then(response => {
    // { message: "success_code", data: {...}, timestamp: "..." }
    if (response.message.includes('success')) {
      showSuccess('저장되었습니다.');
      updateUserList(response.data);
    } else {
      showError(translateErrorCode(response.message));
    }
  })
  .catch(error => {
    console.error('API Error:', error);
    showError('서버 오류가 발생했습니다.');
  });
}
```

---

## 3. 응집도 (Cohesion)

### 원칙
관련된 HTML, 스타일, 스크립트는 함께 관리한다.

### 실무 가이드라인

#### 3.1 컴포넌트별 파일 구성
```
origin_source/
└── static/
    ├── pages/
    │   └── user/
    │       ├── list.html      # 사용자 목록 HTML
    │       ├── detail.html    # 사용자 상세 HTML
    │       └── fragments/     # 재사용 HTML 조각
    │           ├── header.html
    │           └── modal.html
    ├── css/
    │   ├── common/            # 공통 스타일
    │   │   ├── reset.css
    │   │   ├── layout.css
    │   │   └── variables.css
    │   ├── components/        # 컴포넌트 스타일
    │   │   ├── button.css
    │   │   └── card.css
    │   └── pages/             # 페이지별 스타일
    │       └── user/
    │           ├── list.css
    │           └── detail.css
    └── js/
        ├── common/            # 공통 유틸리티
        │   ├── api.js
        │   ├── utils.js
        │   └── validation.js
        └── pages/             # 페이지별 로직
            └── user/
                ├── list.js
                └── detail.js
```

#### 3.2 관련 설정 그룹화
```javascript
// ✅ Good - 페이지별 설정 객체
const PageConfig = {
  user: {
    api: {
      list: 'http://localhost:8080/users',
      detail: 'http://localhost:8080/users/{id}',
      save: 'http://localhost:8080/users'
    },
    messages: {
      saveSuccess: '저장되었습니다.',
      deleteConfirm: '정말 삭제하시겠습니까?'
    },
    validation: {
      nameMinLength: 2,
      nameMaxLength: 50
    }
  }
};
```

#### 3.3 재사용 함수 모듈화
```javascript
// common/utils.js - 공통 유틸리티
const CommonUtils = {
  // 날짜 포맷
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    // ...
  },

  // XSS 방지
  escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // 공통 AJAX 래퍼 (JWT 토큰 자동 포함)
  async fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('access_token');
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };
    return fetch(url, {...defaultOptions, ...options});
  }
};
```

---

## 4. 결합도 (Coupling)

### 원칙
JavaScript는 특정 DOM 구조에 과도하게 의존하지 않는다.

### 실무 가이드라인

#### 4.1 선택자 추상화
```javascript
// ❌ Bad - DOM 구조 강한 의존
function updateUserName() {
  const name = document.querySelector('#userForm > div:nth-child(2) > input').value;
  document.querySelector('.content .user-info span:first-child').textContent = name;
}

// ✅ Good - 의미있는 선택자 (data 속성)
function updateUserName() {
  const name = document.querySelector('[data-field="userName"]').value;
  document.querySelector('[data-display="userName"]').textContent = name;
}
```

#### 4.2 HTML-스크립트 분리
```html
<!-- ❌ Bad - 인라인 스크립트 과다 -->
<div class="user-list">
  <div class="user-item">
    <button onclick="deleteUser(123)">Delete</button>
    <script>
      var userId = 123;
      console.log('User:', userId);
    </script>
  </div>
</div>

<!-- ✅ Good - 데이터와 동작 분리 -->
<div class="user-list">
  <div class="user-item" data-user-id="123">
    <button class="btn-delete" data-action="delete">Delete</button>
  </div>
</div>
<script src="/js/pages/user/list.js"></script>
```

---

## 프로젝트 구조 가이드

### 현재 프로젝트 구조

**참조**: [CLAUDE.md - 디렉토리 구조](../../CLAUDE.md#디렉토리-구조) (전체 프로젝트 구조)

```
ktb_community_fe/
├── server.js              # Express 정적 파일 서버
├── package.json           # 프로젝트 설정
└── origin_source/
    └── static/
        ├── css/
        │   ├── common/    # reset, layout, variables, typography
        │   ├── components/  # button, card, header, modal 등
        │   └── pages/     # 페이지별 스타일 (board/, user/)
        ├── js/
        │   ├── common/    # api, utils, validation
        │   └── pages/     # 페이지별 로직 (board/, user/)
        └── pages/
            ├── board/     # 게시글 HTML 페이지
            ├── user/      # 사용자 HTML 페이지
            └── fragments/ # 재사용 HTML 조각
```

### JavaScript 파일 구조 템플릿
```javascript
// pages/user/list.js
(function(window, document) {
  'use strict';

  // 설정
  const CONFIG = {
    API_URL: 'http://localhost:8080/users',
    PAGE_SIZE: 20
  };

  // 상태 관리
  const state = {
    currentPage: 1,
    users: []
  };

  // DOM 요소 캐싱
  const elements = {
    userList: null,
    pagination: null,
    searchInput: null
  };

  // 초기화
  function init() {
    cacheElements();
    bindEvents();
    loadUsers();
  }

  // DOM 요소 캐싱
  function cacheElements() {
    elements.userList = document.querySelector('[data-user-list]');
    elements.pagination = document.querySelector('[data-pagination]');
    elements.searchInput = document.querySelector('[data-search]');
  }

  // 이벤트 바인딩
  function bindEvents() {
    elements.searchInput?.addEventListener('input', debounce(handleSearch, 300));
    document.addEventListener('click', handleGlobalClick);
  }

  // 전역 클릭 핸들러 (이벤트 위임)
  function handleGlobalClick(e) {
    if (e.target.matches('[data-action="delete"]')) {
      handleDelete(e.target.dataset.id);
    }
  }

  // 사용자 목록 로드
  async function loadUsers() {
    try {
      const response = await fetchWithAuth(`${CONFIG.API_URL}?page=${state.currentPage}`);
      const data = await response.json();
      renderUsers(data.data.users);
    } catch (error) {
      console.error('Failed to load users:', error);
      showError('사용자 목록을 불러오는데 실패했습니다.');
    }
  }

  // DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
```

---

## 코드 리뷰 체크리스트

### HTML 체크리스트
- [ ] 시맨틱 HTML 태그 사용 (header, main, section, article)
- [ ] data-* 속성으로 JavaScript 훅 제공
- [ ] 인라인 스타일/스크립트 최소화
- [ ] 접근성 속성 (aria-label, role) 적절히 사용

### JavaScript 체크리스트
- [ ] 전역 변수 사용을 최소화했는가? (IIFE 패턴)
- [ ] DOM 조작이 최소화되었는가?
- [ ] 이벤트 위임을 활용했는가?
- [ ] AJAX 에러 처리가 적절한가?
- [ ] JWT 토큰이 Authorization 헤더에 포함되었는가?

### CSS 체크리스트
- [ ] BEM 명명 규칙 준수
- [ ] CSS 변수 활용 (색상, 간격 등)
- [ ] 컴포넌트 스타일 분리
- [ ] 반응형 디자인 적용

### 통합 체크리스트
- [ ] HTML/CSS/JS 책임이 명확한가?
- [ ] 데이터 속성(data-*)을 활용했는가?
- [ ] 페이지별 JS/CSS가 적절히 분리되었는가?
- [ ] XSS 방지 (escapeHtml 사용)

---

## 실무 적용 우선순위

### 상황별 가이드
1. **신규 페이지 개발 시**
   - HTML 구조 설계 > JavaScript 모듈화 > 스타일 분리

2. **기존 페이지 개선 시**
   - 인라인 스크립트 제거 > 이벤트 위임 적용 > 컴포넌트 분리

3. **성능 개선 시**
   - DOM 조작 최소화 > 이벤트 위임 > 디바운싱/쓰로틀링

---

## 즉시 적용 가능한 규칙

### 🔴 필수 규칙 (반드시 준수)
1. **인라인 스크립트 최소화**
   - onclick 대신 data 속성 + addEventListener 사용
2. **JWT 토큰 포함**
   - 모든 인증 API 요청에 Authorization 헤더 포함
3. **전역 변수 사용 금지**
   - IIFE 또는 모듈 패턴 사용
4. **XSS 방지**
   - 사용자 입력 출력 시 escapeHtml() 사용

### 🟡 권장 규칙 (가능한 준수)
1. **HTML Fragment 기준**
   - 3번 이상 반복되는 HTML은 JavaScript 템플릿 함수로 분리
   - 복잡한 구조는 fragments/ 디렉토리에 별도 HTML 파일로 관리

2. **JavaScript 파일 크기**
   - 페이지별 JS: 300줄 이하 권장
   - 공통 모듈: 200줄 이하 권장
   - 복잡한 기능: 500줄까지 허용

3. **선택자 성능**
   - ID > data 속성 > Class > 태그 순으로 사용
   - 깊이 3단계 이상의 선택자 지양

### 🟢 상황별 유연 적용
1. **Vanilla JS vs jQuery**
   - 현재 프로젝트: Vanilla JS 사용 (jQuery 없음)
   - 필요 시 작은 유틸리티 라이브러리만 추가

2. **정적 리소스 관리**
   - 개발: 파일 분리 유지
   - 운영: 필요 시 번들링/압축 고려

3. **백엔드 API 연동**
   - Spring Boot API (localhost:8080) 사용
   - API 응답 형식: `{ message, data, timestamp }`

---

## 참고 문서

**프로젝트 전체 맥락**:
- **[CLAUDE.md](../../CLAUDE.md)**: 프로젝트 개요, 아키텍처, 마이그레이션 전략
- **[FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md)**: API 연동 실무 가이드
- **⭐ [API.md](../be/API.md)**: REST API 명세 - **엔드포인트/에러 코드 SSOT**
- **⭐ [LLD.md](../be/LLD.md)**: 백엔드 설계 문서 - **구현 패턴 SSOT**
