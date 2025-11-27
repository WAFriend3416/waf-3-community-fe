const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// 서버 시작 시 config.js 생성 (환경변수 기반)
// ========================================
const BACKEND_URL = process.env.BACKEND_URL !== undefined ? process.env.BACKEND_URL : 'http://localhost:8080';
const LAMBDA_API_URL = process.env.LAMBDA_API_URL !== undefined ? process.env.LAMBDA_API_URL : null;

const configPath = path.join(__dirname, 'origin_source', 'static', 'config.js');
const configContent = `window.APP_CONFIG = {
  API_BASE_URL: '${BACKEND_URL}',
  LAMBDA_API_URL: ${LAMBDA_API_URL ? `'${LAMBDA_API_URL}'` : 'null'}
};`;

fs.writeFileSync(configPath, configContent);
console.log(`✅ Generated config.js with BACKEND_URL=${BACKEND_URL}`);
if (LAMBDA_API_URL) {
  console.log(`✅ Lambda API URL: ${LAMBDA_API_URL}`);
}

// ========================================
// .html 직접 접근 → Clean URL 리다이렉트 (정적 파일 서빙보다 먼저)
// ========================================
app.get('*.html', (req, res, next) => {
  const redirectMap = {
    '/pages/user/login.html': '/page/login',
    '/pages/user/register.html': '/page/register',
    '/pages/user/profile-edit.html': '/page/profile',
    '/pages/user/password-change.html': '/page/password',
    '/pages/board/list.html': '/board',
    '/pages/board/write.html': '/board/write',
    '/pages/home/index.html': '/',
  };

  if (redirectMap[req.path]) {
    return res.redirect(301, redirectMap[req.path]);
  }

  next();
});

// ========================================
// Clean URL Routing (간소화된 URL) - 정적 파일 서빙보다 먼저
// ========================================

// 홈 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/home/index.html'));
});

// 사용자 페이지
app.get('/page/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/user/login.html'));
});

app.get('/page/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/user/register.html'));
});

app.get('/page/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/user/profile-edit.html'));
});

app.get('/page/password', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/user/password-change.html'));
});

// 게시글 페이지
app.get('/board', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/board/list.html'));
});

app.get('/board/write', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/board/write.html'));
});

app.get('/board/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/board/detail.html'));
});

app.get('/board/:id/edit', (req, res) => {
  res.sendFile(path.join(__dirname, 'origin_source/static/pages/board/edit.html'));
});

// ========================================
// 백엔드 SSR 페이지 리다이렉트 (Thymeleaf)
// ========================================
app.get('/terms', (req, res) => {
  res.redirect(`${BACKEND_URL}/terms`);
});

app.get('/privacy', (req, res) => {
  res.redirect(`${BACKEND_URL}/privacy`);
});

// ========================================
// 정적 파일 서빙 (Clean URL 라우팅 후에 실행)
// ========================================
app.use(express.static(path.join(__dirname, 'origin_source/static'), {
  index: false,      // 디렉토리 리스팅 비활성화
  dotfiles: 'ignore' // 숨김 파일 무시
}));

// 404 처리
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'origin_source/static/pages/errors/404.html'));
});

// 서버 시작
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('✅ KTB 커뮤니티 프론트엔드 서버 실행 중');
  console.log('='.repeat(50));
});
