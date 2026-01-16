/**
 * 네비게이션 공통 모듈
 * - 저장되지 않은 변경사항 경고
 * - 브라우저 뒤로가기 방지
 */

let beforeunloadHandler = null;

/**
 * 저장되지 않은 변경사항 경고 활성화
 * 페이지 이탈 시 사용자에게 확인 메시지 표시
 *
 * @param {Function} hasChangesGetter - 변경사항 여부를 반환하는 함수 (예: () => state.hasChanges)
 */
function enableUnsavedChangesWarning(hasChangesGetter) {
  if (typeof hasChangesGetter !== 'function') {
    console.error('enableUnsavedChangesWarning: hasChangesGetter must be a function');
    return;
  }

  beforeunloadHandler = (event) => {
    if (hasChangesGetter()) {
      event.preventDefault();
      event.returnValue = '';
      return '';
    }
  };

  window.addEventListener('beforeunload', beforeunloadHandler);
}

/**
 * 저장되지 않은 변경사항 경고 비활성화
 * 정상적인 폼 제출 시 호출하여 경고 제거
 */
function disableUnsavedChangesWarning() {
  if (beforeunloadHandler) {
    window.removeEventListener('beforeunload', beforeunloadHandler);
    beforeunloadHandler = null;
  }
}
