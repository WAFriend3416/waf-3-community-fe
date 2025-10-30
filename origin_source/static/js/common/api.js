/**
 * API Utility
 * in-memory Access Token + HttpOnly Cookie Refresh Token 인증
 * 참조: @CLAUDE.md Section 3.1, 3.2
 * 참조: @docs/fe/FRONTEND_GUIDE.md Section 2
 */

// API Base URL
// 추후 서버 분리시, 환경 변수 처리 필수
const API_BASE_URL = 'http://localhost:8080';
const LOGIN_URL = '/pages/user/login.html';

// ========================================
// in-memory Access Token 관리
// ========================================

/**
 * Access Token 저장소 (순수 in-memory)
 * - F5 새로고침 시 null로 초기화됨
 * - Refresh Token(HttpOnly Cookie)으로 자동 복원
 */
let accessToken = null;

/**
 * Access Token 조회
 * @returns {string|null}
 */
function getAccessToken() {
    return accessToken;
}

/**
 * Access Token 저장
 * @param {string} token - JWT Access Token
 */
function setAccessToken(token) {
    accessToken = token;
}

/**
 * Access Token 제거
 */
function removeAccessToken() {
    accessToken = null;
}

// ========================================
// JWT 디코딩
// ========================================

/**
 * JWT 디코딩 (payload 추출)
 * - 서명 검증은 서버에서 수행
 * - 프론트엔드는 userId 추출만 목적
 *
 * @param {string} token - JWT 토큰
 * @returns {Object|null} - payload 객체 또는 null
 */
function decodeJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('JWT decode failed:', error);
        return null;
    }
}

/**
 * JWT에서 userId 추출
 * @param {string} token - JWT Access Token
 * @returns {number|null} - userId 또는 null
 */
function getUserIdFromToken(token) {
    if (!token) return null;

    const payload = decodeJWT(token);
    if (!payload || !payload.sub) {
        console.warn('Invalid JWT payload or missing sub claim');
        return null;
    }

    const userId = parseInt(payload.sub, 10);
    return isNaN(userId) ? null : userId;
}

/**
 * HttpOnly Cookie 기반 Fetch 래퍼
 * - Cookie 자동 전송 (credentials: 'include')
 * - CSRF 토큰 자동 추가 (POST/PATCH/DELETE)
 * - 401 Unauthorized 시 자동 토큰 갱신 및 재시도
 * - ApiResponse 형식 처리 (data 필드 자동 추출)
 *
 * @param {string} url - API 엔드포인트 (예: '/posts', '/auth/login')
 * @param {Object} options - fetch options
 * @returns {Promise<any>} - ApiResponse.data 또는 { success: true }
 */
async function fetchWithAuth(url, options = {}) {
    const csrfToken = getCsrfToken();

    const config = {
        ...options,
        credentials: 'include',  // HttpOnly Cookie 자동 전송
        headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'X-XSRF-TOKEN': csrfToken }),  // CSRF 토큰 추가
            ...options.headers
        }
    };

    try {
        const response = await fetch(`${API_BASE_URL}${url}`, config);

        // 401 Unauthorized → 에러 코드 우선 체크
        if (response.status === 401) {
            // ① 에러 코드 먼저 확인 (response.clone() 사용)
            const clonedResponse = response.clone();
            try {
                const errorData = await clonedResponse.json();

                // ② 로그인 실패 등 인증 정보 오류는 토큰 갱신하지 않고 바로 throw
                const authFailures = ['AUTH-001']; // Invalid credentials
                const errorCode = errorData.message?.match(/([A-Z]+-\d+)/)?.[1];

                if (authFailures.includes(errorCode)) {
                    throw new Error(errorData.message);
                }
            } catch (parseError) {
                // JSON 파싱 실패 또는 에러 throw 시
                if (parseError.message?.match(/([A-Z]+-\d+)/)) {
                    // 명시적으로 던진 에러면 그대로 throw
                    throw parseError;
                }
                // JSON 파싱 실패면 기존 로직 진행
                console.warn('Failed to parse 401 error response:', parseError);
            }

            // ③ 그 외 401(토큰 만료 등)은 토큰 갱신 시도
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                // 토큰 갱신 성공 → 원래 요청 재시도
                const retryResponse = await fetch(`${API_BASE_URL}${url}`, config);
                return handleResponse(retryResponse);
            } else {
                // 토큰 갱신 실패 → 로그인 페이지로 리다이렉트
                logout();
                window.location.href = LOGIN_URL;
                throw new Error('Authentication failed');
            }
        }

        return handleResponse(response);
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

/**
 * 응답 처리
 * - 204 No Content: { success: true } 반환
 * - 200 OK: ApiResponse.data 필드 반환
 * - 4xx/5xx: Error throw
 *
 * @param {Response} response - fetch Response 객체
 * @returns {Promise<any>}
 */
async function handleResponse(response) {
    if (response.status === 204) return { success: true };

    const data = await response.json();
    if (response.ok) return data.data; // ApiResponse의 data 필드 반환

    throw new Error(data.message || 'API request failed');
}

// 토큰 갱신 Promise 캐시 (동시 호출 방지)
let refreshTokenPromise = null;

/**
 * Access Token 갱신
 * POST /auth/refresh_token 호출
 * - refresh_token은 HttpOnly Cookie로 자동 전송
 * - 응답 body의 access_token을 메모리에 저장
 * - 동시 호출 방지: 여러 요청이 동시에 갱신을 시도해도 한 번만 실행
 *
 * @returns {Promise<boolean>} 갱신 성공 여부
 */
async function refreshAccessToken() {
    // 이미 갱신 중이면 기존 Promise 반환 (중복 호출 방지)
    if (refreshTokenPromise) {
        return refreshTokenPromise;
    }

    // 새로운 갱신 시작
    refreshTokenPromise = (async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/refresh_token`, {
                method: 'POST',
                credentials: 'include',  // refresh_token Cookie 자동 전송
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                // 응답 body의 access_token을 메모리에 저장
                if (data.data && data.data.access_token) {
                    setAccessToken(data.data.access_token);
                    return true;
                }
                console.error('Token refresh response missing access_token:', data);
                return false;
            }
            return false;
        } catch (error) {
            console.error('Token refresh failed:', error);
            return false;
        } finally {
            // 갱신 완료 후 캐시 초기화 (다음 갱신을 위해)
            refreshTokenPromise = null;
        }
    })();

    return refreshTokenPromise;
}

/**
 * 로그아웃
 * - POST /auth/logout 호출 (서버에서 refresh_token 무효화 및 Cookie 삭제)
 * - 메모리에서 access_token 제거
 *
 * 참고: /auth/logout은 인증 필요 (SecurityConfig)
 */
async function logout() {
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include',  // Cookie 자동 전송
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Logout request failed:', error);
    }

    // 메모리에서 access_token 제거
    removeAccessToken();

    // 서버가 Cookie 삭제 처리 (MaxAge=0)
}

/**
 * 로그인 여부 확인
 *
 * 메모리의 access_token 존재 여부로 로그인 상태 판단
 * - F5 새로고침 시 토큰이 없으면 자동 복원 로직이 필요 (ensureAuthenticated 사용)
 *
 * @returns {boolean} - access_token이 있으면 true, 없으면 false
 */
function isAuthenticated() {
    const token = getAccessToken();
    return !!token;
}

/**
 * 인증 상태 확인 및 자동 복원
 * - F5 시 메모리 토큰 없으면 RT로 갱신 시도
 * - 복원 실패 시 로그인 페이지로 리다이렉트
 *
 * 사용법: 보호된 페이지의 init() 함수 시작 부분에서 호출
 * ```
 * async function init() {
 *     const authenticated = await ensureAuthenticated();
 *     if (!authenticated) return;
 *     // ... 기존 로직
 * }
 * ```
 *
 * @returns {Promise<boolean>} - 인증 성공 여부
 */
async function ensureAuthenticated() {
    if (!getAccessToken()) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            window.location.href = LOGIN_URL;
            return false;
        }
    }
    return true;
}

/**
 * 현재 사용자 ID 조회
 *
 * 메모리의 access_token을 JWT 디코딩하여 userId 추출
 *
 * @returns {number|null}
 */
function getCurrentUserId() {
    const token = getAccessToken();

    if (!token) {
        console.warn('Access token not found in memory');
        return null;
    }

    return getUserIdFromToken(token);
}

/**
 * 이미지 업로드
 * POST /images (multipart/form-data)
 *
 * @param {File} file - 업로드할 이미지 파일
 * @returns {Promise<{image_id: number, image_url: string}>}
 */
async function uploadImage(file) {
    const csrfToken = getCsrfToken();
    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    if (csrfToken) {
        headers['X-XSRF-TOKEN'] = csrfToken;
    }

    const response = await fetch(`${API_BASE_URL}/images`, {
        method: 'POST',
        credentials: 'include',  // Cookie 자동 전송
        headers: headers,  // CSRF 토큰 추가
        body: formData  // Content-Type 자동 설정 (multipart/form-data)
    });

    const data = await response.json();
    if (response.ok) return data.data; // { image_id, image_url }

    throw new Error(data.message);
}

/**
 * ErrorCode → 사용자 친화적 메시지 변환
 * 백엔드 ErrorCode (28개) → 한글 메시지
 * 참조: @docs/be/LLD.md Section 8
 *
 * @param {string} code - ErrorCode (예: "USER-002", "AUTH-001")
 * @returns {string} - 사용자 메시지
 */
function translateErrorCode(code) {
    const errorMessages = {
        // AUTH 에러
        'AUTH-001': '이메일 또는 비밀번호가 일치하지 않습니다.',
        'AUTH-002': '유효하지 않은 토큰입니다.',
        'AUTH-003': '토큰이 만료되었습니다.',
        'AUTH-004': '유효하지 않은 리프레시 토큰입니다.',

        // USER 에러
        'USER-001': '사용자를 찾을 수 없습니다.',
        'USER-002': '이미 사용 중인 이메일입니다.',
        'USER-003': '이미 사용 중인 닉네임입니다.',
        'USER-004': '비밀번호는 8-20자, 대/소/특수문자를 각각 1개 이상 포함해야 합니다.',
        'USER-005': '계정이 비활성화되었습니다.',
        'USER-006': '비밀번호가 일치하지 않습니다.',
        'USER-007': '권한이 없습니다.',

        // POST 에러
        'POST-001': '게시글을 찾을 수 없습니다.',
        'POST-002': '게시글 작성자만 수정/삭제할 수 있습니다.',
        'POST-003': '이미 삭제된 게시글입니다.',
        'POST-004': '유효하지 않은 게시글 상태입니다.',

        // COMMENT 에러
        'COMMENT-001': '댓글을 찾을 수 없습니다.',
        'COMMENT-002': '댓글 작성자만 수정/삭제할 수 있습니다.',
        'COMMENT-003': '이미 삭제된 댓글입니다.',

        // LIKE 에러
        'LIKE-001': '이미 좋아요를 눌렀습니다.',
        'LIKE-002': '좋아요를 찾을 수 없습니다.',

        // IMAGE 에러
        'IMAGE-001': '이미지를 찾을 수 없습니다.',
        'IMAGE-002': '파일 크기는 5MB 이하여야 합니다.',
        'IMAGE-003': '지원하지 않는 파일 형식입니다. (JPG, PNG, GIF만 가능)',

        // COMMON 에러
        'COMMON-001': '입력 데이터가 올바르지 않습니다.',
        'COMMON-002': '리소스를 찾을 수 없습니다.',
        'COMMON-003': '리소스 충돌이 발생했습니다.',
        'COMMON-004': '요청 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.',
        'COMMON-999': '서버 오류가 발생했습니다.'
    };

    // ErrorCode 추출 (예: "USER-002: Email already exists" → "USER-002")
    const match = code.match(/([A-Z]+-\d+)/);
    return match ? (errorMessages[match[1]] || code) : code;
}

/**
 * CSRF 토큰 추출
 * XSRF-TOKEN 쿠키에서 토큰 값을 읽어옴
 *
 * @returns {string|null} - CSRF 토큰 또는 null
 */
function getCsrfToken() {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; XSRF-TOKEN=`);
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
    return null;
}
