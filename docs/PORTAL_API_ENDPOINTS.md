# Portal API Endpoints Used by Dotts

## Authentication Endpoints
- **POST** `/api/isfl/v1/auth/login` - User login with username/password
- **POST** `/api/isfl/v1/auth/token` - Refresh access token using refresh token

## User Endpoints
- **GET** `/api/isfl/v1/user` - Get current user info (requires JWT token)
- **GET** `/api/isfl/v1/user/permissions` - Get user permissions (requires JWT token)
- **GET** `/api/isfl/v1/userinfo` - Get all users info (public, no auth)
- **GET** `/api/isfl/v1/userinfo?uid={userId}` - Get specific user info by UID (public, no auth)

## Player Endpoints
- **GET** `/api/isfl/v1/player?pid={playerId}` - Get player details
- **GET** `/api/isfl/v1/player/stats?pid={playerId}` - Get player stats
- **GET** `/api/isfl/v1/player/rankings?pid={playerId}&seasonType={RegularSeason|PostSeason}` - Get player rankings
- **GET** `/api/isfl/v1/awards?pid={playerId}` - Get player awards

## Bank/Finance Endpoints
- **GET** `/api/isfl/v1/bank/header-info?uid={userId}` - Get user's bank balance
- **POST** `/api/isfl/v1/bank/transactions/external-create` - Create bank transactions (requires API token)

## Base URLs
- **Production**: `https://portal-api.pbe.simflow.io`
- **Default Fallback**: `https://portal-api.pbe.simflow.io`

## Authentication Types

### 1. No Authentication (Public)
- `/api/isfl/v1/userinfo` (both with and without UID param)

### 2. JWT Token Authentication (User logged in)
- `/api/isfl/v1/user`
- `/api/isfl/v1/user/permissions`
- `/api/isfl/v1/player/*`
- `/api/isfl/v1/awards`
- `/api/isfl/v1/bank/header-info`

### 3. API Token Authentication (External Integration)
- `/api/isfl/v1/bank/transactions/external-create`

### 4. Username/Password Only (No header auth)
- `/api/isfl/v1/auth/login`

## Notes
- Most endpoints return JSON responses
- JWT tokens expire after 15 minutes
- Refresh tokens are stored in cookies and database
- API token is only used for bank transaction creation
- All endpoints are accessed through the `portalApiService` in `services/portalApiService.ts`

## Request Flow

1. **Login**: User provides username/password → receives JWT access token + refresh token
2. **Authenticated Requests**: Include JWT in `Authorization: Bearer {token}` header
3. **Token Refresh**: When JWT expires, use refresh token to get new JWT
4. **Bank Transactions**: Use API token in `Authorization: Bearer {apiKey}` header (only for external-create endpoint)
