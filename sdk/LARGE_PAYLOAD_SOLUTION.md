# Large Payload Solution (15MB+)

## Problem
AWS Lambda has a 6MB request size limit, API Gateway has a 10MB limit. Need to handle payloads up to 15MB+.

## Solution: S3 Upload Strategy

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Small Payload (<4MB after compression)                      │
│ SDK → Compress → Lambda → Database                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Large Payload (≥4MB after compression)                       │
│ 1. SDK → Lambda: GET /get-upload-url → Presigned S3 URL    │
│ 2. SDK → S3: PUT (upload compressed data)                   │
│ 3. SDK → Lambda: POST /send-call-log (with s3_key)         │
│ 4. Lambda → S3: Download → Process → Database              │
└─────────────────────────────────────────────────────────────┘
```

### Benefits

1. **Scalable** - Handles payloads up to 5GB (S3 limit)
2. **Simple** - No chunking, no coordination
3. **Backward Compatible** - Existing code works unchanged
4. **Cost-effective** - S3 storage is cheap (~$0.023/GB/month)
5. **Reliable** - S3 has 99.999999999% durability

### Implementation Steps

#### 1. SDK Changes (Python)
- Add S3 upload threshold (4MB)
- Add function to get presigned URL
- Add function to upload to S3
- Modify `send_to_whispey()` to use S3 for large payloads

#### 2. Lambda Changes (Node.js)
- Add endpoint `/get-upload-url` to generate presigned URLs
- Modify `/send-call-log` to detect S3 uploads
- Add function to download from S3
- Process data from S3 instead of request body

#### 3. Infrastructure Changes
- Create S3 bucket: `pype-voice-large-payloads`
- Add S3 permissions to Lambda IAM role
- Set bucket lifecycle policy (delete after 7 days)

### Alternative Approaches Considered

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Chunking** | Works within Lambda limits | Complex, multiple requests, needs coordination | ❌ Rejected |
| **SQS Extended** | AWS managed | Adds complexity, queue overhead | ❌ Rejected |
| **S3 Upload** | Scalable, simple, reliable | Requires S3 bucket | ✅ **CHOSEN** |
| **API Gateway increase** | Simple | Still has 10MB limit, not enough | ❌ Not feasible |

### Cost Analysis (for 15MB payload)

**S3 Upload Approach:**
- S3 PUT: $0.005 per 1,000 requests = $0.000005/upload
- S3 Storage: $0.023/GB/month × 0.015GB × 7 days = $0.000008
- S3 GET: $0.0004 per 1,000 requests = $0.0000004/download
- **Total: ~$0.000013 per 15MB payload**

**Chunking Approach:**
- 5 Lambda invocations instead of 1
- More complex = more maintenance cost
- Higher error rate = more retries

### Security Considerations

1. **Presigned URLs** - Expire after 15 minutes
2. **Bucket Policy** - Only Lambda can read
3. **Lifecycle** - Auto-delete after 7 days
4. **Encryption** - Server-side encryption (AES-256)

### Monitoring

```javascript
// CloudWatch metrics to track
- LargePayloadCount
- S3UploadDuration
- S3UploadSize
- S3DownloadDuration
```

## Conclusion

The S3 upload strategy is the **best production solution** for handling 15MB+ payloads. It's simple, scalable, cost-effective, and backward compatible.

