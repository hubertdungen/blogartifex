@echo off
REM Helper script to install dependencies and start BlogArtifex

IF NOT EXIST node_modules (
  echo Installing dependencies...
  npm install
)

npm start
