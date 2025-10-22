/**
 * Password Change Page Script
 * 비밀번호 변경 페이지 로직
 * 참조: @docs/be/API.md Section 2.4
 */

(function(window, document) {
  'use strict';

  const CONFIG = {
    LIST_URL: '/pages/board/list.html'
  };

  const state = {
    userId: null,
    isSubmitting: false  // 중복 제출 방지 플래그
  };

  const elements = {
    form: null,
    currentPasswordInput: null,
    newPasswordInput: null,
    newPasswordConfirmInput: null,
    currentPasswordError: null,
    newPasswordError: null,
    newPasswordConfirmError: null,
    saveButton: null
  };

  async function init() {
    try {
      const userId = getCurrentUserId();

      // userId 검증 (null, undefined만 체크)
      if (!userId) {
        console.error('Failed to get userId');
        alert('로그인이 필요합니다.');
        window.location.href = '/pages/user/login.html';
        return;
      }

      state.userId = userId;

      cacheElements();
      bindEvents();
    } catch (error) {
      console.error('Initialization failed:', error);
      alert('로그인이 필요합니다.');
      window.location.href = '/pages/user/login.html';
    }
  }

  function cacheElements() {
    elements.form = document.querySelector('[data-form="password-change"]');
    elements.currentPasswordInput = document.querySelector('[data-field="currentPassword"]');
    elements.newPasswordInput = document.querySelector('[data-field="newPassword"]');
    elements.newPasswordConfirmInput = document.querySelector('[data-field="newPasswordConfirm"]');
    elements.currentPasswordError = document.querySelector('[data-error="currentPassword"]');
    elements.newPasswordError = document.querySelector('[data-error="newPassword"]');
    elements.newPasswordConfirmError = document.querySelector('[data-error="newPasswordConfirm"]');
    elements.saveButton = document.querySelector('[data-action="save"]');
  }

  function bindEvents() {
    if (elements.form) {
      elements.form.addEventListener('submit', handleSubmit);
    }
    document.querySelector('[data-action="go-back"]')?.addEventListener('click', e => {
      e.preventDefault();
      window.history.back();
    });

    // 실시간 검증 (blur 이벤트)
    if (elements.currentPasswordInput) {
      elements.currentPasswordInput.addEventListener('blur', () => validateField('currentPassword'));
    }
    if (elements.newPasswordInput) {
      elements.newPasswordInput.addEventListener('blur', () => validateField('newPassword'));
    }
    if (elements.newPasswordConfirmInput) {
      elements.newPasswordConfirmInput.addEventListener('blur', () => validateField('newPasswordConfirm'));
    }

    // 입력 시 에러 메시지 제거
    if (elements.currentPasswordInput) {
      elements.currentPasswordInput.addEventListener('input', () => clearCurrentPasswordError());
    }
    if (elements.newPasswordInput) {
      elements.newPasswordInput.addEventListener('input', () => clearNewPasswordError());
    }
    if (elements.newPasswordConfirmInput) {
      elements.newPasswordConfirmInput.addEventListener('input', () => clearNewPasswordConfirmError());
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // 중복 제출 방지
    if (state.isSubmitting) {
      return;
    }

    const currentPassword = elements.currentPasswordInput.value;
    const newPassword = elements.newPasswordInput.value;
    const newPasswordConfirm = elements.newPasswordConfirmInput.value;

    // 검증
    if (!validateForm(currentPassword, newPassword, newPasswordConfirm)) {
      return;
    }

    state.isSubmitting = true;
    elements.saveButton.disabled = true;
    elements.saveButton.textContent = '변경 중...';

    try {
      await fetchWithAuth(`/users/${state.userId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({
          newPassword: newPassword,
          newPasswordConfirm: newPasswordConfirm
        })
      });

      alert('비밀번호가 변경되었습니다. 다시 로그인해주세요.');
      logout();
      window.location.href = '/pages/user/login.html';
    } catch (error) {
      console.error('Failed to change password:', error);

      // 에러 코드별 처리
      const errorMessage = error.message;
      if (errorMessage.includes('USER-006')) {
        showCurrentPasswordError('현재 비밀번호가 일치하지 않습니다.');
      } else if (errorMessage.includes('USER-004')) {
        showNewPasswordError('비밀번호 정책을 만족하지 않습니다.');
      } else {
        alert(translateErrorCode(errorMessage) || '비밀번호 변경에 실패했습니다.');
      }

      state.isSubmitting = false;
      elements.saveButton.disabled = false;
      elements.saveButton.textContent = '변경';
    }
  }

  function validateField(field) {
    if (field === 'currentPassword') {
      const currentPassword = elements.currentPasswordInput.value;
      if (!currentPassword) {
        showCurrentPasswordError('현재 비밀번호를 입력해주세요.');
        return false;
      }
      clearCurrentPasswordError();
      return true;
    }

    if (field === 'newPassword') {
      const newPassword = elements.newPasswordInput.value;
      if (!newPassword) {
        showNewPasswordError('새 비밀번호를 입력해주세요.');
        return false;
      }
      if (!isValidPassword(newPassword)) {
        showNewPasswordError('8-20자, 영문 대/소문자, 숫자, 특수문자를 포함해야 합니다.');
        return false;
      }
      clearNewPasswordError();
      return true;
    }

    if (field === 'newPasswordConfirm') {
      const newPassword = elements.newPasswordInput.value;
      const newPasswordConfirm = elements.newPasswordConfirmInput.value;
      if (!newPasswordConfirm) {
        showNewPasswordConfirmError('새 비밀번호 확인을 입력해주세요.');
        return false;
      }
      if (newPassword !== newPasswordConfirm) {
        showNewPasswordConfirmError('새 비밀번호가 일치하지 않습니다.');
        return false;
      }
      clearNewPasswordConfirmError();
      return true;
    }

    return true;
  }

  function validateForm(currentPassword, newPassword, newPasswordConfirm) {
    let isValid = true;

    // 현재 비밀번호 확인
    if (!currentPassword) {
      showCurrentPasswordError('현재 비밀번호를 입력해주세요.');
      isValid = false;
    } else {
      clearCurrentPasswordError();
    }

    // 새 비밀번호 정책 확인
    if (!newPassword) {
      showNewPasswordError('새 비밀번호를 입력해주세요.');
      isValid = false;
    } else if (!isValidPassword(newPassword)) {
      showNewPasswordError('8-20자, 영문 대/소문자, 숫자, 특수문자를 포함해야 합니다.');
      isValid = false;
    } else {
      clearNewPasswordError();
    }

    // 새 비밀번호 확인 일치 확인
    if (!newPasswordConfirm) {
      showNewPasswordConfirmError('새 비밀번호 확인을 입력해주세요.');
      isValid = false;
    } else if (newPassword !== newPasswordConfirm) {
      showNewPasswordConfirmError('새 비밀번호가 일치하지 않습니다.');
      isValid = false;
    } else {
      clearNewPasswordConfirmError();
    }

    return isValid;
  }

  function showCurrentPasswordError(message) {
    if (elements.currentPasswordError) {
      elements.currentPasswordError.textContent = message;
      elements.currentPasswordError.style.display = 'block';
    }
  }

  function clearCurrentPasswordError() {
    if (elements.currentPasswordError) {
      elements.currentPasswordError.textContent = '';
      elements.currentPasswordError.style.display = 'none';
    }
  }

  function showNewPasswordError(message) {
    if (elements.newPasswordError) {
      elements.newPasswordError.textContent = message;
      elements.newPasswordError.style.display = 'block';
    }
  }

  function clearNewPasswordError() {
    if (elements.newPasswordError) {
      elements.newPasswordError.textContent = '';
      elements.newPasswordError.style.display = 'none';
    }
  }

  function showNewPasswordConfirmError(message) {
    if (elements.newPasswordConfirmError) {
      elements.newPasswordConfirmError.textContent = message;
      elements.newPasswordConfirmError.style.display = 'block';
    }
  }

  function clearNewPasswordConfirmError() {
    if (elements.newPasswordConfirmError) {
      elements.newPasswordConfirmError.textContent = '';
      elements.newPasswordConfirmError.style.display = 'none';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
