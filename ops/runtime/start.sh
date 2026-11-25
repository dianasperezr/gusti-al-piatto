#!/bin/sh
set -eu

app_dir=${GUSTI_APP_DIR:-/app}
cd "$app_dir/runtime-tools"
./node_modules/.bin/prisma migrate deploy

cd "$app_dir"
exec node server.js
