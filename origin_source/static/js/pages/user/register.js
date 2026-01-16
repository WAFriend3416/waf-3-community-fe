/**
 * Register Page Script
 * 회원가입 페이지 로직
 * 참조: @CLAUDE.md Section 4.5, @docs/be/API.md Section 2.1
 */

(function (window, document) {
  'use strict';

  // ============================================
  // Configuration
  // ============================================
  const CONFIG = {
    LOGIN_URL: '/page/login',
    LIST_URL: '/board',
    MAX_NICKNAME_LENGTH: 10,
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  };

  // ============================================
  // State Management
  // ============================================
  const state = {
    isSubmitting: false, // 중복 제출 방지 플래그
  };

  // ============================================
  // DOM Element Caching
  // ============================================
  const elements = {
    form: null,
    profileImageInput: null,
    profileImagePreview: null,
    profileImageElement: null,
    profilePlaceholder: null,
    emailInput: null,
    passwordInput: null,
    passwordConfirmInput: null,
    nicknameInput: null,
    submitButton: null,
    goBackButton: null,
    // Password toggle (비밀번호 표시/숨김)
    passwordToggle: null,
    passwordConfirmToggle: null,
    // Error elements
    profileImageError: null,
    emailError: null,
    passwordError: null,
    passwordConfirmError: null,
    nicknameError: null,
  };

  /**
   * Guest Token 발급 (회원가입 페이지 로드 시)
   * 용도: 프로필 이미지 업로드를 위한 임시 인증
   */
  async function fetchGuestToken() {
    try {
      const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || '';
      const API_PREFIX = window.APP_CONFIG?.API_PREFIX || '';
      const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/guest-token`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const guestToken = data.data; // Guest Token 문자열

        // sessionStorage에 저장 (페이지 새로고침 시에도 유지)
        sessionStorage.setItem('guestToken', guestToken);
        console.log('✅ Guest Token issued for signup');
        return guestToken;
      } else {
        console.error('Failed to fetch guest token:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Guest token fetch error:', error);
      return null;
    }
  }

  /**
   * 초기화
   */
  function init() {
    cacheElements();
    bindEvents();
  }

  /**
   * DOM 요소 캐싱
   */
  function cacheElements() {
    elements.form = document.querySelector('[data-form="register"]');
    elements.profileImageInput = document.querySelector('[data-field="profileImage"]');
    elements.profileImagePreview = document.querySelector('[data-preview="profile"]');
    elements.profileImageElement = document.querySelector('[data-image="profile"]');
    elements.profilePlaceholder = document.querySelector('[data-placeholder="profile"]');
    elements.emailInput = document.querySelector('[data-field="email"]');
    elements.passwordInput = document.querySelector('[data-field="password"]');
    elements.passwordConfirmInput = document.querySelector('[data-field="passwordConfirm"]');
    elements.nicknameInput = document.querySelector('[data-field="nickname"]');
    elements.submitButton = document.querySelector('[data-action="register"]');
    elements.goBackButton = document.querySelector('[data-action="go-back"]');

    // Password toggle
    elements.passwordToggle = document.querySelector('[data-action="toggle-password"]');
    elements.passwordConfirmToggle = document.querySelector(
      '[data-action="toggle-password-confirm"]'
    );

    // Error elements
    elements.profileImageError = document.querySelector('[data-error="profileImage"]');
    elements.emailError = document.querySelector('[data-error="email"]');
    elements.passwordError = document.querySelector('[data-error="password"]');
    elements.passwordConfirmError = document.querySelector('[data-error="passwordConfirm"]');
    elements.nicknameError = document.querySelector('[data-error="nickname"]');
  }

  /**
   * 이벤트 바인딩
   */
  function bindEvents() {
    elements.form.addEventListener('submit', handleSubmit);
    elements.profileImageInput.addEventListener('change', handleImageChange);
    elements.goBackButton.addEventListener('click', () => window.history.back());

    // 실시간 검증 (blur 이벤트)
    elements.emailInput.addEventListener('blur', () => validateField('email'));
    elements.passwordInput.addEventListener('blur', () => validateField('password'));
    elements.passwordConfirmInput.addEventListener('blur', () => validateField('passwordConfirm'));
    elements.nicknameInput.addEventListener('blur', () => validateField('nickname'));

    // 비밀번호 토글 버튼
    if (elements.passwordToggle) {
      elements.passwordToggle.addEventListener('click', () => togglePasswordVisibility('password'));
    }
    if (elements.passwordConfirmToggle) {
      elements.passwordConfirmToggle.addEventListener('click', () =>
        togglePasswordVisibility('passwordConfirm')
      );
    }

    // 입력 시 에러 메시지 제거
    elements.profileImageInput.addEventListener('change', () => clearError('profileImage'));
    elements.emailInput.addEventListener('input', () => clearError('email'));
    elements.passwordInput.addEventListener('input', () => clearError('password'));
    elements.passwordConfirmInput.addEventListener('input', () => clearError('passwordConfirm'));
    elements.nicknameInput.addEventListener('input', () => clearError('nickname'));
  }

  /**
   * 프로필 이미지 변경 핸들러
   */
  async function handleImageChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 파일 검증
    const error = getImageFileError(file);
    if (error) {
      showError('profileImage', error);
      event.target.value = '';
      return;
    }

    // Guest Token이 없으면 발급 (이미지 업로드를 위한 임시 인증)
    if (!sessionStorage.getItem('guestToken')) {
      console.log('Guest Token 발급 중... (이미지 업로드용)');
      await fetchGuestToken();
    }

    // 미리보기 표시
    const reader = new FileReader();
    reader.onload = (e) => {
      elements.profileImageElement.src = e.target.result;
      elements.profileImageElement.style.display = 'block';
      elements.profilePlaceholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  /**
   * 폼 제출 핸들러
   * POST /users/signup (application/json)
   * - 2단계 업로드: 프로필 이미지 → imageId 획득 → JSON 방식 회원가입
   */
  async function handleSubmit(event) {
    event.preventDefault();

    // 중복 제출 방지
    if (state.isSubmitting) {
      return;
    }

    // 폼 검증
    if (!validateForm()) {
      return;
    }

    const email = sanitizeInput(elements.emailInput.value);
    const password = elements.passwordInput.value;
    const nickname = sanitizeInput(elements.nicknameInput.value);
    const profileImage = elements.profileImageInput.files[0];

    try {
      state.isSubmitting = true;
      setLoading(true);

      // 1단계: 프로필 이미지 업로드 (선택)
      let imageId = null;
      if (profileImage) {
        try {
          const imageResult = await uploadImage(profileImage);
          imageId = imageResult.imageId;
        } catch (error) {
          console.error('Image upload failed:', error);
          const translatedMessage = translateErrorCode(error.message);
          showError('profileImage', translatedMessage || '이미지 업로드에 실패했습니다.');
          state.isSubmitting = false;
          setLoading(false);
          return;
        }
      }

      // 2단계: 회원가입 (JSON)
      let response;
      try {
        const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || '';
        const API_PREFIX = window.APP_CONFIG?.API_PREFIX || '';
        response = await fetch(`${API_BASE_URL}${API_PREFIX}/users/signup`, {
          method: 'POST',
          credentials: 'include', // HttpOnly Cookie 수신
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, nickname, imageId }),
        });
      } catch (error) {
        // Network Error 감지 (TypeError "Failed to fetch")
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          const networkError = new Error('NETWORK-ERROR');
          networkError.originalError = error;
          throw networkError;
        }
        throw error;
      }

      const data = await response.json();

      if (response.ok) {
        // 응답 body의 accessToken을 localStorage에 저장
        if (data.data && data.data.accessToken) {
          setAccessToken(data.data.accessToken);
        }

        // Guest Token 정리 (더 이상 필요 없음)
        sessionStorage.removeItem('guestToken');

        // 회원가입 성공 - 자동 로그인되어 게시글 목록으로 이동
        Toast.success('회원가입이 완료되었습니다.', '환영합니다', 2000, () => {
          window.location.href = CONFIG.LIST_URL;
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      handleRegisterError(error);
    } finally {
      state.isSubmitting = false;
      setLoading(false);
    }
  }

  /**
   * 개별 필드 검증 (blur 이벤트용)
   * @param {string} field - 필드명
   * @returns {boolean}
   */
  function validateField(field) {
    clearError(field);

    if (field === 'email') {
      const email = sanitizeInput(elements.emailInput.value);

      if (!email) {
        showError('email', '이메일을 입력해주세요.');
        return false;
      } else if (hasExcessiveWhitespace(elements.emailInput.value)) {
        showError('email', '이메일에 공백이 너무 많습니다.');
        return false;
      } else if (!isValidEmail(email)) {
        showError('email', '올바른 이메일 형식이 아닙니다.');
        return false;
      }
      return true;
    }

    if (field === 'password') {
      const password = elements.passwordInput.value;

      if (!password) {
        showError('password', '비밀번호를 입력해주세요.');
        return false;
      } else if (!isValidPassword(password)) {
        showError('password', getPasswordPolicyMessage());
        return false;
      }
      return true;
    }

    if (field === 'passwordConfirm') {
      const password = elements.passwordInput.value;
      const passwordConfirm = elements.passwordConfirmInput.value;

      if (!passwordConfirm) {
        showError('passwordConfirm', '비밀번호 확인을 입력해주세요.');
        return false;
      } else if (!isPasswordMatch(password, passwordConfirm)) {
        showError('passwordConfirm', '비밀번호가 일치하지 않습니다.');
        return false;
      }
      return true;
    }

    if (field === 'nickname') {
      const nickname = sanitizeInput(elements.nicknameInput.value);

      if (!nickname) {
        showError('nickname', '닉네임을 입력해주세요.');
        return false;
      } else if (hasExcessiveWhitespace(elements.nicknameInput.value)) {
        showError('nickname', '닉네임에 공백이 너무 많습니다.');
        return false;
      } else if (hasRepeatingCharacters(nickname, 3)) {
        showError('nickname', '같은 문자를 너무 많이 반복할 수 없습니다.');
        return false;
      } else if (!isValidNickname(nickname)) {
        showError('nickname', `닉네임은 1-${CONFIG.MAX_NICKNAME_LENGTH}자 이내로 입력해주세요.`);
        return false;
      }
      return true;
    }

    return true;
  }

  /**
   * 폼 유효성 검증
   * @returns {boolean}
   */
  function validateForm() {
    let isValid = true;

    // 모든 필드 검증
    if (!validateField('email')) isValid = false;
    if (!validateField('password')) isValid = false;
    if (!validateField('passwordConfirm')) isValid = false;
    if (!validateField('nickname')) isValid = false;

    return isValid;
  }

  /**
   * 회원가입 에러 처리
   * @param {Error} error
   */
  function handleRegisterError(error) {
    const message = error.message || '';
    const translatedMessage = translateErrorCode(message);

    // NETWORK-ERROR: 네트워크 연결 실패 (필드 에러 아님)
    if (message === 'NETWORK-ERROR') {
      Toast.error(translatedMessage, '네트워크 오류', 3000);
      return;
    }

    // USER-002: 이메일 중복
    if (message.includes('USER-002')) {
      showError('email', translatedMessage);
    }
    // USER-003: 닉네임 중복
    else if (message.includes('USER-003')) {
      showError('nickname', translatedMessage);
    }
    // USER-004: 비밀번호 정책 위반
    else if (message.includes('USER-004')) {
      showError('password', translatedMessage);
    }
    // IMAGE-002: 파일 크기 초과
    else if (message.includes('IMAGE-002')) {
      showError('profileImage', translatedMessage);
    }
    // IMAGE-003: 파일 형식 오류
    else if (message.includes('IMAGE-003')) {
      showError('profileImage', translatedMessage);
    }
    // 기타 에러
    else {
      showError('email', translatedMessage || '회원가입에 실패했습니다.');
    }
  }

  /**
   * 에러 메시지 표시
   * @param {string} field
   * @param {string} message
   */
  function showError(field, message) {
    const errorMap = {
      profileImage: elements.profileImageError,
      email: elements.emailError,
      password: elements.passwordError,
      passwordConfirm: elements.passwordConfirmError,
      nickname: elements.nicknameError,
    };

    const inputMap = {
      profileImage: elements.profileImageInput,
      email: elements.emailInput,
      password: elements.passwordInput,
      passwordConfirm: elements.passwordConfirmInput,
      nickname: elements.nicknameInput,
    };

    const errorElement = errorMap[field];
    const inputElement = inputMap[field];

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }

    if (inputElement && field !== 'profileImage') {
      inputElement.classList.add('input-field__input--error');
    }
  }

  /**
   * 에러 메시지 제거
   * @param {string} field
   */
  function clearError(field) {
    const errorMap = {
      profileImage: elements.profileImageError,
      email: elements.emailError,
      password: elements.passwordError,
      passwordConfirm: elements.passwordConfirmError,
      nickname: elements.nicknameError,
    };

    const inputMap = {
      profileImage: elements.profileImageInput,
      email: elements.emailInput,
      password: elements.passwordInput,
      passwordConfirm: elements.passwordConfirmInput,
      nickname: elements.nicknameInput,
    };

    const errorElement = errorMap[field];
    const inputElement = inputMap[field];

    if (errorElement) {
      errorElement.textContent = '';
      errorElement.style.display = 'none';
    }

    if (inputElement && field !== 'profileImage') {
      inputElement.classList.remove('input-field__input--error');
    }
  }

  /**
   * 비밀번호 표시/숨김 토글
   * @param {string} field - 'password' | 'passwordConfirm'
   */
  function togglePasswordVisibility(field) {
    // 두 입력 필드와 버튼을 모두 처리
    const inputs = [elements.passwordInput, elements.passwordConfirmInput];
    const buttons = [elements.passwordToggle, elements.passwordConfirmToggle];

    // 현재 상태 확인 (첫 번째 필드 기준)
    if (!elements.passwordInput) return;
    const isPasswordVisible = elements.passwordInput.type === 'text';

    // 두 필드 모두 동시에 토글
    inputs.forEach((input) => {
      if (input) {
        input.type = isPasswordVisible ? 'password' : 'text';
      }
    });

    buttons.forEach((button) => {
      if (button) {
        if (isPasswordVisible) {
          button.setAttribute('aria-label', '비밀번호 표시');
          button.classList.remove('password-toggle--visible');
        } else {
          button.setAttribute('aria-label', '비밀번호 숨기기');
          button.classList.add('password-toggle--visible');
        }
      }
    });
  }

  /**
   * 로딩 상태 설정
   * @param {boolean} loading
   */
  function setLoading(loading) {
    if (loading) {
      elements.submitButton.disabled = true;
      elements.submitButton.classList.add('btn--loading');
    } else {
      elements.submitButton.disabled = false;
      elements.submitButton.classList.remove('btn--loading');
    }
  }

  // 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
