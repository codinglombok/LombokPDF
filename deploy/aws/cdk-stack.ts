/**
 * LombokPDF — AWS CDK Stack
 * Deploys LombokPDF as an ECS Fargate service behind an Application Load Balancer.
 *
 * Usage:
 *   npm install -g aws-cdk
 *   cdk bootstrap
 *   cdk deploy LombokPDFStack
 */

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'

export interface LombokPDFStackProps extends cdk.StackProps {
  /** Number of Fargate tasks (default: 2) */
  desiredCount?: number
  /** CPU units — 256 = 0.25 vCPU (default: 256, plenty for LombokPDF) */
  cpu?: number
  /** Memory in MiB (default: 512 — LombokPDF is lean) */
  memoryLimitMiB?: number
  /** Enable CloudFront CDN in front of the ALB (default: true) */
  enableCloudFront?: boolean
  /** Docker image tag (default: 'latest') */
  imageTag?: string
}

export class LombokPDFStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LombokPDFStackProps = {}) {
    super(scope, id, props)

    const {
      desiredCount     = 2,
      cpu              = 256,
      memoryLimitMiB   = 512,     // LombokPDF: 256MB is enough; 512MB gives headroom
      enableCloudFront = true,
      imageTag         = 'latest',
    } = props

    // ─── VPC ───────────────────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'LombokPDFVpc', {
      maxAzs: 2,
      natGateways: 1,   // cost optimization — single NAT gateway
    })

    // ─── Certificate secret (optional — for PKCS#7 signing) ───────────────
    const certSecret = new secretsmanager.Secret(this, 'LombokPDFCertPassword', {
      description: 'PKCS#12 certificate password for PDF digital signing',
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 32,
      },
    })

    // ─── ECS Cluster ───────────────────────────────────────────────────────
    const cluster = new ecs.Cluster(this, 'LombokPDFCluster', {
      vpc,
      containerInsights: true,
    })

    // ─── Fargate Service with ALB ──────────────────────────────────────────
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'LombokPDFService',
      {
        cluster,
        cpu,
        memoryLimitMiB,
        desiredCount,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry(`lombokdigital/lombokpdf:${imageTag}`),
          containerPort: 3000,
          environment: {
            NODE_ENV: 'production',
          },
          secrets: {
            CERT_PASS: ecs.Secret.fromSecretsManager(certSecret),
          },
          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: 'lombokpdf',
            logRetention: logs.RetentionDays.TWO_WEEKS,
          }),
        },
        publicLoadBalancer: true,
        healthCheckGracePeriod: cdk.Duration.seconds(30),
        circuitBreaker: { rollback: true },
      }
    )

    // Health check configuration
    fargateService.targetGroup.configureHealthCheck({
      path:                '/health',
      interval:            cdk.Duration.seconds(30),
      timeout:             cdk.Duration.seconds(5),
      healthyThresholdCount:   2,
      unhealthyThresholdCount: 3,
    })

    // ─── Auto Scaling ──────────────────────────────────────────────────────
    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: desiredCount,
      maxCapacity: desiredCount * 5,
    })

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 60,
      scaleInCooldown:  cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(30),
    })

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 70,
    })

    // ─── Optional CloudFront CDN ───────────────────────────────────────────
    if (enableCloudFront) {
      const distribution = new cloudfront.Distribution(this, 'LombokPDFCDN', {
        defaultBehavior: {
          origin: new origins.LoadBalancerV2Origin(fargateService.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          viewerProtocolPolicy:  cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy:           cloudfront.CachePolicy.CACHING_DISABLED,  // PDFs are dynamic
          allowedMethods:        cloudfront.AllowedMethods.ALLOW_ALL,
        },
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      })

      new cdk.CfnOutput(this, 'CloudFrontURL', {
        value: `https://${distribution.distributionDomainName}`,
        description: 'CloudFront distribution URL',
      })
    }

    // ─── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: 'Application Load Balancer DNS name',
    })

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
    })
  }
}

// ─── App entry point ──────────────────────────────────────────────────────────

const app = new cdk.App()

new LombokPDFStack(app, 'LombokPDFStack', {
  env: {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region:  process.env['CDK_DEFAULT_REGION'] ?? 'ap-southeast-1',
  },
  desiredCount:     2,
  cpu:              256,
  memoryLimitMiB:   512,
  enableCloudFront: true,
})
