# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-15

### Added

- Structured logger with `json`, `pretty`, and `cloud` formats
- Request ID helpers (`withRequestId`, `getRequestId`, Express middleware)
- Optional OpenTelemetry context injection (no hard OTel dependency)
- GCP / AWS / Azure friendly cloud log shapes
- Size-based file rotation destination (zero runtime deps)
- Dual ESM + CJS + TypeScript declarations
