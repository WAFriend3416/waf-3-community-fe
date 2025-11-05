const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// API Base URL 설정 (환경변수 기반)
// ========================================
// 로컬: localhost:8080
// EC2: EC2_PUBLIC_IP 환경변수 사용 (Public IP로 브라우저 접근)
const API_BASE_URL = process.env.EC2_PUBLIC_IP
  ? `http://${process.env.EC2_PUBLIC_IP}:8080`
  : 'http://localhost:8080';

console.log(`🔧 API_BASE_URL: ${API_BASE_URL}`);

// ========================================
// HTML 응답 시 API_BASE_URL 주입 미들웨어
// ========================================
app.use((req, res, next) => {
  const originalSendFile = res.sendFile;

  res.sendFile = function(filepath, ...args) {
    if (filepath.endsWith('.html')) {
      // HTML 파일인 경우 API_BASE_URL 주입
      fs.readFile(filepath, 'utf8', (err, data) => {
        if (err) {
          return originalSendFile.call(res, filepath, ...args);
        }

        // </head> 앞에 API_BASE_URL 설정 스크립트 주입
        const apiScript = `<script>window.API_BASE_URL = '${API_BASE_URL}';</script>`;
        const modifiedHtml = data.replace('</head>', `${apiScript}\n</head>`);

        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(modifiedHtml);
      });
    } else {
      // 정적 파일은 원래대로
      return originalSendFile.call(res, filepath, ...args);
    }
  };

  next();
});

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
  console.log(`🌐 로컬 주소:     http://localhost:${PORT}`);
  console.log(`📁 정적 파일:     origin_source/static/`);
  console.log(`🔗 백엔드 API:    http://localhost:8080 (Spring Boot)`);
  console.log(`📄 로그인 페이지: http://localhost:${PORT}/pages/user/login.html`);
  console.log('='.repeat(50));
});
