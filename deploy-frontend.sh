#!/usr/bin/env bash
set -euo pipefail

echo "[frontend] 배포 시작"

# 1) 필수 환경변수 체크
: "${REGISTRY:?REGISTRY is required}"
: "${IMAGE_NAME:?IMAGE_NAME is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${BACKEND_URL:?BACKEND_URL is required}"
: "${API_PREFIX:?API_PREFIX is required}"

echo "[frontend] REGISTRY=${REGISTRY}"
echo "[frontend] IMAGE_NAME=${IMAGE_NAME}"
echo "[frontend] IMAGE_TAG=${IMAGE_TAG}"
echo "[frontend] BACKEND_URL=${BACKEND_URL}"
echo "[frontend] API_PREFIX=${API_PREFIX}"

AWS_REGION="ap-northeast-2"

# 2) ECR 로그인 (여기서부터는 네가 ECR VPC 엔드포인트 세팅해두면, 프라이빗에서도 동작)
echo "[frontend] ECR 로그인 중..."
aws ecr get-login-password --region "${AWS_REGION}" | sudo docker login --username AWS --password-stdin "${REGISTRY}"

# 3) 기존 컨테이너 정리
echo "[frontend] 기존 컨테이너 정리 중..."
sudo docker stop community-fe 2>/dev/null || true
sudo docker rm   community-fe 2>/dev/null || true

# 4) 새 이미지 pull
echo "[frontend] 새 이미지 pull 중..."
sudo docker pull "${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

# 5) 새 컨테이너 실행
echo "[frontend] 새 컨테이너 실행 중..."
sudo docker run -d --name community-fe \
  -p 3000:3000 \
  -e BACKEND_URL="${BACKEND_URL}" \
  -e API_PREFIX="${API_PREFIX}" \
  --restart unless-stopped \
  --memory="512m" \
  "${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

# 6) 헬스체크
echo "[frontend] 헬스체크 중..."
HEALTH_OK=false
for i in $(seq 1 180); do
  if curl -sf http://localhost:3000 >/dev/null 2>&1; then
    echo "[frontend] 헬스체크 성공! (${i}초)"
    HEALTH_OK=true
    break
  fi
  sleep 1
done

if [ "${HEALTH_OK}" = true ]; then
  echo "[frontend] 배포 완료 ✅"
  exit 0
else
  echo "[frontend] 헬스체크 실패 ❌"
  sudo docker logs --tail 50 community-fe || true
  exit 1
fi