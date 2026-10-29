#!/usr/bin/env bash
# Đưa code mới lên máy chủ mà KHÔNG ghi đè dữ liệu thật đang chạy trên máy chủ:
# data.js, ảnh tải lên, mật khẩu quản trị, kết nối Fanpage/YouTube, bản lưu.
#
# Cách dùng:  ./deploy.sh     (nhập mật khẩu SSH, rồi mật khẩu sudo khi được hỏi)
# Địa chỉ máy chủ đọc từ file .deploy.env (không đưa lên GitHub):
#   SERVER=user@ip-may-chu
#   DIR=/home/user/psviet
set -euo pipefail
cd "$(dirname "$0")"
[ -f .deploy.env ] && . ./.deploy.env
: "${SERVER:?Chưa có SERVER trong .deploy.env}"
: "${DIR:?Chưa có DIR trong .deploy.env}"

rsync -avz --delete \
  --exclude '.git/' --exclude '.gitignore' --exclude '.deploy.env' --exclude 'deploy.sh' \
  --exclude '.DS_Store' --exclude '__pycache__/' \
  --exclude '.admin.json' --exclude 'autopost/' --exclude 'backups/' --exclude 'thuong-hieu/' \
  --exclude 'website/data.js' --exclude 'website/assets/uploads/' \
  ./ "$SERVER:$DIR/"

ssh -t "$SERVER" "sudo systemctl restart psviet && echo 'Website: ' \$(systemctl is-active psviet)"
