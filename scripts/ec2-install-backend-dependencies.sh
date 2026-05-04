#!/bin/bash
set -euo pipefail

sudo dnf update -y
sudo dnf install -y git nodejs npm
sudo npm install -g pm2
node -v
npm -v
pm2 -v
