# API Path Corrections Needed

Based on the API_REFERENCE.md, here are the corrections needed:

## Transaction Endpoints
- Current: `/transaction/${signature}`
- Correct: `/api/transaction/${signature}` or `/api/transaction?signature=${signature}`

## Account Endpoints
- `/account-stats/${address}` → `/api/account-stats?address=${address}`
- `/account-portfolio/${address}` → `/api/account-portfolio/${address}` ✅ (correct)
- `/account-transactions/${address}` → `/api/account-transactions?address=${address}`
- `/account-token-stats/${address}/${mint}` → `/api/account-token-stats?address=${address}&mint=${mint}`

## Block Endpoints
- `/blocks/${slot}` → `/api/block?slot=${slot}`
- `/blocks` → `/api/blocks/recent`
- `/blocks/stats` → `/api/blocks/stats`

## Search Endpoints
- `/search` → `/api/search` ✅
- `/search/accounts` → `/api/search/accounts` ✅

## Analytics Endpoints
- `/analytics/overview` → `/api/analytics/overview`
- `/analytics/dex` → `/api/analytics/dex`
- `/analytics/defi-health` → `/api/analytics/defi-health`
- `/analytics/validators` → `/api/analytics/validators`
- `/analytics/trending-validators` → `/api/analytics/trending-validators`
- `/analytics/cross-chain` → `/api/analytics/cross-chain`
- `/analytics/bots` → `/api/analytics/bots`

## Market Data
- `/market-data` → `/api/market-data` ✅

## Token Endpoints
- `/token/${address}` → `/api/token/${address}`
- `/token-metadata` → `/api/token-metadata`

## NFT Endpoints
- `/nft-collections` → `/api/nft-collections`
- `/nft-collections/trending` → `/api/nft-collections/trending`

## Other Endpoints
- `/check-account-type` → `/api/check-account-type`
- `/chart` → `/api/chart`
- `/dex/${name}` → `/api/dex/${name}`
- `/user-history/${walletAddress}` → `/api/user-history/${walletAddress}`

## General Pattern
All endpoints should be prefixed with `/api/`