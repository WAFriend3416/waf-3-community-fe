#!/bin/bash
set -e

ENV_FILE=".env"

cat > $ENV_FILE << EOF
REGISTRY=${1:-registry.ktb-waf.cloud}
IMAGE_NAME=${2:-community-fe}
IMAGE_TAG=${3:-latest}
EOF

echo ".env 파일 생성 완료"
