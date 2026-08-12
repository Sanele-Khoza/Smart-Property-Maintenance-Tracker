# AWS IAM Least-Privilege Policy Reference

> Derived from SDD §6.3–6.7. Use these statements when provisioning IAM policies for the SPMT demo environment.

## Per-Service Policies

| AWS Service | IAM Actions | Resource Scope | Adapter |
|---|---|---|---|
| Comprehend | `comprehend:ClassifyDocument` | Custom endpoint ARN | `comprehendAdapter.js` |
| Rekognition | `rekognition:DetectLabels`, `rekognition:DetectModerationLabels` | Scoped to the SPMT image bucket | `rekognitionAdapter.js` |
| S3 | `s3:PutObject`, `s3:GetObject` | `spmt-ticket-images-*` and `spmt-reports-*` | `s3Adapter.js` |
| SNS | `sns:Publish` | Registered platform applications + SMS phone number ranges | `snsAdapter.js` |
| SES | `ses:SendEmail` | Verified sending domain(s) | `sesAdapter.js` |
| Secrets Manager | `secretsmanager:GetSecretValue` | The three named secrets (`spmt/db`, `spmt/jwt`, `spmt/third-party`) | `secretsAdapter.js` |

## Example Minimal Policy Document

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Comprehend",
      "Effect": "Allow",
      "Action": "comprehend:ClassifyDocument",
      "Resource": "arn:aws:comprehend:REGION:ACCOUNT:document-classifier-endpoint/SPMT_ENDPOINT"
    },
    {
      "Sid": "Rekognition",
      "Effect": "Allow",
      "Action": [
        "rekognition:DetectLabels",
        "rekognition:DetectModerationLabels"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3TicketImages",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::spmt-ticket-images-*",
        "arn:aws:s3:::spmt-reports-*"
      ]
    },
    {
      "Sid": "SNS",
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": [
        "arn:aws:sns:REGION:ACCOUNT:app/GCM/SPMT_TENANT",
        "arn:aws:sns:REGION:ACCOUNT:app/APNS/SPMT_TENANT"
      ]
    },
    {
      "Sid": "SES",
      "Effect": "Allow",
      "Action": "ses:SendEmail",
      "Resource": "*",
      "Condition": {
        "StringLike": {
          "ses:FromAddress": "*@SPMT_DOMAIN"
        }
      }
    },
    {
      "Sid": "SecretsManager",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": [
        "arn:aws:secretsmanager:REGION:ACCOUNT:secret:spmt/db-*",
        "arn:aws:secretsmanager:REGION:ACCOUNT:secret:spmt/jwt-*",
        "arn:aws:secretsmanager:REGION:ACCOUNT:secret:spmt/third-party-*"
      ]
    }
  ]
}
```

## Notes

- Replace `REGION`, `ACCOUNT`, `SPMT_ENDPOINT`, `SPMT_DOMAIN` with actual values at provisioning time.
- Rekognition `Resource: "*"` is required because Rekognition actions operate on the service, not on specific resources.
- SES `Resource: "*"` is similarly required; the condition key `ses:FromAddress` restricts which sending address is allowed.
- Secrets Manager ARNs append a random 6-character dash suffix (e.g. `spmt/db-abc123`); use a trailing `-*` wildcard to match.
- For SMS via SNS, scope to specific origination phone number ARNs or use a `sms_sender_id` condition where supported.

## Regional Exceptions

Both exceptions share the same underlying reason: the AWS feature or training region differs from the project's default `AWS_REGION=af-south-1`, and this is a deviation worth carrying into the SDD's "Known Deviations" section.

- **Rekognition** calls originate from **eu-west-1** (`AWS_REKOGNITION_REGION`, read as `config.aws.rekognition.region`) rather than `af-south-1`, because Rekognition is not available in `af-south-1` as of this project's build date.
- **Comprehend** custom-classifier calls originate from **eu-west-1** (`AWS_COMPREHEND_REGION`, read as `config.aws.comprehendRegion`) rather than `af-south-1`, because the `spmtClassifier` custom classifier was trained in `eu-west-1`.
