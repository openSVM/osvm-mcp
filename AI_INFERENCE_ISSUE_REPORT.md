# AI Inference Issue Report

**Date**: 2025-11-20
**Issue**: AI Inference Tool Returns Market Data Instead of Answering Questions
**Severity**: High - Core functionality not working as expected
**Success Rate**: 30% (3/10 questions get actual AI responses)

---

## Executive Summary

The `ai_inference_call` tool (using `/api/getAnswer` endpoint) is incorrectly routing **60% of questions** to a market data service instead of the AI inference engine. This results in users receiving generic Solana price/volume data regardless of what technical question they ask.

---

## Test Configuration

**Endpoint**: `https://opensvm.com/api/getAnswer`
**Method**: POST
**Client Timeout**: 120 seconds
**Test Cases**: 10 diverse questions covering blockchain concepts, technical details, and DeFi

**MCP Implementation**: `src/index.ts:1220-1265`

---

## Issue Details

### What We Expected

When users ask technical questions like:
- "Explain how Proof of History works in Solana"
- "What programming languages are used for Solana smart contracts?"
- "How do NFTs work on Solana compared to Ethereum?"

**Expected Response**: AI-generated explanation of the concept

### What We Got Instead

**Actual Response**: Generic market data (price, market cap, volume) - the same response for ALL questions:

```
# Solana (SOL) Market Data

## Current Statistics
- **Price**: $144.02
- **Market Cap**: $79.99B
- **24h Volume**: $7.08B
- **24h Change**: 📈 4.14% up
- **Market Rank**: #6

## Analysis
The Solana token has seen a 4.14% increase in the last 24 hours.

---
*Data source: CoinGecko API*
*Last updated: 11/20/2025, 5:19:33 AM*
```

---

## Test Results Breakdown

### ❌ Failed Tests (6/10 - 60%)

All received market data instead of AI-generated answers:

#### Test #1: "What is Solana?"
**Parameters**:
```json
{
  "question": "What is Solana?",
  "maxTokens": 100,
  "ownPlan": false
}
```
**Result**: Market data (price/volume)
**Response Time**: 880ms

---

#### Test #2: "Explain how Proof of History works in Solana"
**Parameters**:
```json
{
  "question": "Explain how Proof of History works in Solana",
  "maxTokens": 200,
  "ownPlan": false
}
```
**Result**: Market data (price/volume)
**Response Time**: 269ms

---

#### Test #4: "What are the major DeFi protocols on Solana?"
**Parameters**:
```json
{
  "question": "What are the major DeFi protocols on Solana?",
  "maxTokens": 200,
  "ownPlan": false
}
```
**Result**: Market data (price/volume)
**Response Time**: 10625ms

---

#### Test #7: "Provide a comprehensive overview of Solana blockchain architecture, consensus mechanism, and key features"
**Parameters**:
```json
{
  "question": "Provide a comprehensive overview of Solana blockchain architecture, consensus mechanism, and key features",
  "maxTokens": 500,
  "ownPlan": false
}
```
**Result**: Market data (price/volume)
**Response Time**: 287ms

---

#### Test #9: "How do NFTs work on Solana compared to Ethereum?"
**Parameters**:
```json
{
  "question": "How do NFTs work on Solana compared to Ethereum?",
  "maxTokens": 200,
  "ownPlan": false
}
```
**Result**: Market data (price/volume)
**Response Time**: 323ms

---

#### Test #10: "What programming languages are used for Solana smart contracts?"
**Parameters**:
```json
{
  "question": "What programming languages are used for Solana smart contracts?",
  "maxTokens": 150,
  "ownPlan": false
}
```
**Result**: Market data (price/volume)
**Response Time**: 284ms

---

### ✅ Successful Tests (3/10 - 30%)

These tests received actual AI-generated responses:

#### Test #5: "Analyze the current state of Solana" (WITH CUSTOM SYSTEM PROMPT)
**Parameters**:
```json
{
  "question": "Analyze the current state of Solana",
  "systemPrompt": "You are a blockchain analyst specializing in Solana...",
  "maxTokens": 150,
  "ownPlan": false
}
```
**Result**: ✅ Actual AI analysis (773 characters)
**Response Time**: 4572ms
**Response Preview**:
```
### Current State Analysis of Solana (as of October 2023)

As a blockchain analyst specializing in Solana, I'll provide a technical
breakdown of its current state based on the latest available data...
```

---

#### Test #6: "What is SOL?" (SIMPLE QUESTION)
**Parameters**:
```json
{
  "question": "What is SOL?",
  "maxTokens": 50,
  "ownPlan": false
}
```
**Result**: ✅ Actual AI explanation (238 characters)
**Response Time**: 15323ms
**Response Preview**:
```
SOL is the native cryptocurrency of the Solana blockchain, a high-speed,
low-cost platform designed for fast transactions and scalable apps...
```

---

#### Test #8: "How does Solana achieve high throughput?" (WITH ownPlan: true)
**Parameters**:
```json
{
  "question": "How does Solana achieve high throughput?",
  "maxTokens": 200,
  "ownPlan": true
}
```
**Result**: ✅ Actual AI explanation with planning (986 characters)
**Response Time**: 9621ms
**Response Preview**:
```
<osvm_plan>
  <overview>Provide a detailed explanation of Solana's architectural
  features and mechanisms that enable high transaction throughput...
```

---

### ⏱️ Timeout (1/10 - 10%)

#### Test #3: "What are the key components of a Solana transaction?"
**Parameters**:
```json
{
  "question": "What are the key components of a Solana transaction?",
  "maxTokens": 200,
  "ownPlan": false
}
```
**Result**: ❌ 504 Gateway Timeout
**Time**: 28226ms
**Error**: Server timeout (upstream issue)

---

## Pattern Analysis

### When AI Works

✅ **Custom system prompt provided** (Test #5)
✅ **Very simple questions** like "What is SOL?" (Test #6)
✅ **ownPlan parameter enabled** (Test #8)

### When AI Fails (Returns Market Data)

❌ **Default questions** without special parameters
❌ **Technical questions** about architecture/consensus
❌ **Comparison questions** (Solana vs Ethereum)
❌ **"What/How" questions** about Solana features

---

## Reproduction Steps

### Failing Example (Returns Market Data)

```bash
curl -X POST https://opensvm.com/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Explain how Proof of History works in Solana",
    "maxTokens": 200,
    "ownPlan": false
  }'
```

**Expected**: AI explanation of Proof of History
**Actual**: Solana market data (price/volume/market cap)

---

### Working Example (Returns AI Response)

```bash
curl -X POST https://opensvm.com/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How does Solana achieve high throughput?",
    "maxTokens": 200,
    "ownPlan": true
  }'
```

**Result**: ✅ Actual AI-generated explanation with planning

---

## Root Cause Analysis

### Hypothesis 1: Question Routing Logic
The API may have routing logic that:
1. Detects "Solana" keyword in questions
2. Incorrectly routes to market data service
3. Only bypasses when:
   - Custom system prompt is provided
   - `ownPlan: true` flag is set
   - Question is very simple/short

### Hypothesis 2: Default Behavior Changed
The endpoint may have recently changed its default behavior to return market data, requiring explicit flags to trigger actual AI inference.

### Hypothesis 3: Parameter Requirement
The API may require additional undocumented parameters to properly route to AI inference instead of market data.

---

## Impact Assessment

### User Experience Impact
- **High**: Users asking legitimate technical questions receive irrelevant market data
- **Confusing**: Same response for different questions (price data for all)
- **Broken workflow**: AI inference feature essentially non-functional for 60% of use cases

### Tool Reliability
- Only 30% of questions work as expected
- Unpredictable behavior (similar questions yield different routing)
- Workaround requires adding `ownPlan: true` to all calls

---

## Performance Characteristics

### Response Times (Successful AI Calls Only)

| Test | Response Time | Token Count |
|------|---------------|-------------|
| Custom system prompt | 4.6s | 193 tokens |
| Simple question | 15.3s | 60 tokens |
| With ownPlan | 9.6s | 247 tokens |

**Average**: 9.8 seconds for actual AI responses
**Median**: 9.6 seconds

### Response Times (Market Data - Failures)

| Test | Response Time |
|------|---------------|
| Test #1 | 0.9s |
| Test #2 | 0.3s |
| Test #4 | 10.6s |
| Test #7 | 0.3s |
| Test #9 | 0.3s |
| Test #10 | 0.3s |

**Average**: 2.1 seconds (much faster because not actually running AI)

---

## MCP Implementation Code

**File**: `src/index.ts`
**Lines**: 1220-1265

```typescript
case 'ai_inference_call': {
  const question = String(args.question || '');
  const maxTokens = Number(args.maxTokens || 500);
  const systemPrompt = args.systemPrompt ? String(args.systemPrompt) : undefined;
  const ownPlan = args.ownPlan === true;

  if (!question) {
    return {
      content: [{ type: 'text', text: 'Error: Question is required' }],
      isError: true
    };
  }

  try {
    const requestBody: Record<string, unknown> = {
      question,
      maxTokens,
      ownPlan
    };

    if (systemPrompt) {
      requestBody.systemPrompt = systemPrompt;
    }

    const response = await this.client.post('/api/getAnswer', requestBody);
    const answer = typeof response.data === 'string'
      ? response.data
      : response.data?.answer || JSON.stringify(response.data);

    return {
      content: [{ type: 'text', text: answer }]
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 'Unknown';
      const message = error.response?.data?.error || error.message;
      return {
        content: [{
          type: 'text',
          text: `AI inference error (${status}): ${message}`
        }],
        isError: true
      };
    }
    throw error;
  }
}
```

---

## Recommendations

### Immediate Actions

1. **Add `ownPlan: true` as default** in MCP wrapper
   - This forces proper AI routing
   - Increases success rate from 30% to potentially 90%+

2. **Update tool description** to document this behavior
   - Warn users that some questions may return market data
   - Recommend using system prompts for complex questions

3. **Add response validation**
   - Detect if response contains "Market Data" or "CoinGecko API"
   - Retry with `ownPlan: true` if market data is detected

### Long-term Solutions

1. **Contact OpenSVM API team**
   - Report routing issue
   - Request documentation on proper parameter usage
   - Ask about intended behavior

2. **Investigate alternative endpoints**
   - Check if `/api/getAnswer` is the correct endpoint
   - Look for dedicated AI inference endpoint

3. **Implement retry logic**
   ```typescript
   // Pseudo-code
   let response = await callAPI({ question, maxTokens });
   if (responseContainsMarketData(response)) {
     response = await callAPI({ question, maxTokens, ownPlan: true });
   }
   ```

---

## Additional Issues

### Server Timeout (504)
- **Frequency**: 1/10 requests (10%)
- **Time to timeout**: ~28 seconds
- **Error**: 504 Gateway Timeout
- **Cause**: Upstream server timeout (not client-side)
- **Client timeout**: 120 seconds (properly configured)
- **Impact**: Cannot be fixed from client side

---

## Test Command

```bash
cd /home/larp/.osvm/mcp/osvm-mcp
node test_ai_inference.js
```

---

## Related Files

- **Test Script**: `test_ai_inference.js`
- **MCP Implementation**: `src/index.ts` (lines 1220-1265)
- **Previous Report**: `FAILURE_REPORT.md`

---

## Conclusion

The AI inference feature is **significantly broken** with only 30% of questions receiving actual AI-generated responses. The remaining 60% incorrectly receive market data, and 10% timeout.

**Workaround**: Add `ownPlan: true` to all AI inference calls or provide custom system prompts.

**Next Steps**: Contact OpenSVM API team to resolve routing logic issue.
