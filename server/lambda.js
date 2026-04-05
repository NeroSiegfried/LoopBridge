/**
 * LoopBridge — AWS Lambda Handler
 *
 * Wraps the Express app for API Gateway / ALB via @vendia/serverless-express.
 *
 * To use:
 *   1. npm install @vendia/serverless-express
 *   2. Set this file as the Lambda handler: lambda.handler
 *   3. Configure env vars: DB_TYPE, DATABASE_URL, STORAGE_DRIVER, S3_BUCKET, etc.
 *
 * The static frontend should be served from S3 + CloudFront,
 * NOT through this Lambda (remove the static-files middleware in prod).
 */
'use strict';

const serverlessExpress = require('@vendia/serverless-express');
const { app } = require('./index');

// Cache the serverless handler across warm invocations
let serverlessHandler;

exports.handler = async (event, context) => {
    if (!serverlessHandler) {
        serverlessHandler = serverlessExpress({ app });
    }
    return serverlessHandler(event, context);
};
