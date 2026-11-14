# Technical Decision: Authentication and Multi-Tenancy Scope

Date: 2026-02-28
Author: Security & Architecture
Project: WhyThen

## Decision: Zero Cloud Authentication for Desktop MVP

We evaluated whether to include user authentication (OAuth2, Auth0, or local password JWTs) in WhyThen.

We decided to reject cloud authentication and user login screens for the MVP release. WhyThen will operate strictly as a single-user local application bound to localhost.

### Rationale
- 100% Offline Air-Gapped Operation: Users must be able to search and query confidential personal notes and trade secrets on flights or offline environments without an internet connection.
- Threat Model: The primary threat model for a local desktop assistant is network leakage. Adding external OAuth providers introduces network round-trips, third-party tracking, and remote credential storage.
- File System Security: Local file access permissions are already enforced by the host operating system's user account.
- Binding Safeguards: The backend server binds strictly to `127.0.0.1` and enforces approved-directory path validation to protect against external network attacks.
