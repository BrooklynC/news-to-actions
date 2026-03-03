# Export Storage Lifecycle Rules

When using S3-compatible storage (`EXPORT_STORAGE_BACKEND=s3`) for org export artifacts, configure bucket lifecycle rules to automatically expire objects after a retention period.

## Rationale

Export artifacts are ephemeral. They are generated on-demand and delivered via signed URLs. To prevent unbounded storage growth, lifecycle rules should delete objects after a defined retention window (e.g., 7 days).

## Configuration

Lifecycle rules must be configured at the bucket level. The application does not set lifecycle rules; they are configured via the cloud provider console, AWS CLI, or IaC.

### AWS S3

```json
{
  "Rules": [
    {
      "ID": "ExportArtifactExpiration",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "org/"
      },
      "Expiration": {
        "Days": 7
      }
    }
  ]
}
```

Apply via AWS CLI:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket YOUR_BUCKET_NAME \
  --lifecycle-configuration file://lifecycle.json
```

### Cloudflare R2

R2 supports S3-compatible lifecycle rules. Configure via the R2 dashboard or S3 API.

### MinIO

MinIO supports expiration via `mc ilm` or bucket lifecycle configuration. Consult MinIO docs for your version.

## Required Env Vars (S3 Backend)

| Env Var | Required | Description |
|---------|----------|-------------|
| `EXPORT_STORAGE_BACKEND` | No | Set to `s3` to use S3 backend; default `local_fs` |
| `EXPORT_S3_BUCKET` | Yes (when s3) | Bucket name |
| `EXPORT_S3_REGION` | No | Region; defaults to `AWS_REGION` or `us-east-1` |
| `EXPORT_S3_ENDPOINT` | No | Custom endpoint for R2/MinIO |
| `EXPORT_S3_FORCE_PATH_STYLE` | No | Set to `1` for MinIO |
| `AWS_ACCESS_KEY_ID` | Yes (when s3) | Credentials |
| `AWS_SECRET_ACCESS_KEY` | Yes (when s3) | Credentials |

## Verification

- After creating an export artifact, verify it appears in the bucket.
- Confirm signed URL returns the object within the expiry window.
- After the lifecycle retention period, object should be deleted (verify via console or `aws s3 ls`).
