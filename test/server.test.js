/**
 * 서버 시작 테스트
 * CI에서 서버가 정상적으로 시작되는지 확인
 */

const http = require('http');
const { spawn } = require('child_process');

const PORT = 3001; // 테스트용 포트
const TIMEOUT = 10000; // 10초

async function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('node', ['server.js'], {
      env: { ...process.env, PORT },
      stdio: 'pipe',
    });

    let started = false;

    server.stdout.on('data', (data) => {
      if (data.toString().includes('서버 실행 중') && !started) {
        started = true;
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    server.on('error', reject);

    setTimeout(() => {
      if (!started) {
        server.kill();
        reject(new Error('서버 시작 타임아웃'));
      }
    }, TIMEOUT);
  });
}

async function testHealthCheck(server) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${PORT}`, (res) => {
      server.kill();
      if (res.statusCode >= 200 && res.statusCode < 400) {
        resolve(true);
      } else {
        reject(new Error(`HTTP 상태 코드: ${res.statusCode}`));
      }
    });

    req.on('error', (err) => {
      server.kill();
      reject(err);
    });

    req.setTimeout(5000, () => {
      server.kill();
      reject(new Error('요청 타임아웃'));
    });
  });
}

async function main() {
  console.log('🧪 서버 시작 테스트');

  try {
    console.log('  서버 시작 중...');
    const server = await startServer();

    console.log('  헬스체크 중...');
    await testHealthCheck(server);

    console.log('✅ 테스트 통과!');
    process.exit(0);
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    process.exit(1);
  }
}

main();
