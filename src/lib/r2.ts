import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const handler = new NodeHttpHandler({
  connectionTimeout: 60000, // 1 minute
  socketTimeout: 300000,   // 5 minutes
});

export const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT as string,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
  maxAttempts: 5,
  requestHandler: handler,
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME as string;
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL as string;
