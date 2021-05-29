// CDK stack that does the following:
// 1) Deploys static site to S3 bucket.
// 2) Adds ACM certificate for monomerbio.com
// 3) Creates cloudfront distribution for static site S3 bucket deployment.
// 4) Invalidates all static files in distribution (invalidates the cache)
// 5) Creates a route 53 alias that maps monomerbio.com to the static files.

const cdk = require('@aws-cdk/core');
const s3 = require('@aws-cdk/aws-s3');
const route53 = require("@aws-cdk/aws-route53");
const cloudfront = require('@aws-cdk/aws-cloudfront');
const acm = require("@aws-cdk/aws-certificatemanager");
const targets = require("@aws-cdk/aws-route53-targets/lib");
const s3Deployment = require('@aws-cdk/aws-s3-deployment');

class CdkStack extends cdk.Stack {
  /**
   *
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // Lookup the zone based on domain name
    const zone = route53.HostedZone.fromLookup(this, 'baseZone', {
      domainName: 'monomerbio.com'
    });

    // The site domain to deploy
    const siteDomain = "monomerbio.com"
    new cdk.CfnOutput(this, "Site", { value: "https://" + siteDomain })

    // Create the public S3 bucket
    const publicAssets = new s3.Bucket(this, 'monomer-bio-static-site', {
      bucketName: 'monomer-bio-static-site',
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      websiteIndexDocument: 'index.html',
    });
    new cdk.CfnOutput(this, "Bucket", { value: publicAssets.bucketName })

    // TLS certificate
    const certificate = new acm.DnsValidatedCertificate(
      this,
      "SiteCertificate",
      {
        domainName: siteDomain,
        hostedZone: zone,
        // Cloudfront only checks this region for certificates. Must be us-east-1, even if primary region is elsewhere.
        region: "us-east-1",
      }
    )
    new cdk.CfnOutput(this, "Certificate", { value: certificate.certificateArn })

    // CloudFront distribution that provides HTTPS
    const distribution = new cloudfront.CloudFrontWebDistribution(
      this,
      "SiteDistribution",
      {
        viewerCertificate: cloudfront.ViewerCertificate.fromAcmCertificate(
          certificate,
          {
            aliases: [siteDomain],
          },
        ),
        originConfigs: [
          {
            customOriginSource: {
              domainName: publicAssets.bucketWebsiteDomainName,
              originProtocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            },
            behaviors: [{ isDefaultBehavior: true }],
          },
        ],
      }
    )

    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
    })

    // Route53 alias record for the CloudFront distribution
    new route53.ARecord(this, "SiteAliasRecord", {
      recordName: siteDomain,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
      zone,
    })

    // Static Code in to Bucket.
    new s3Deployment.BucketDeployment(
      this,
      'deploy-static-website',
      {
        sources: [s3Deployment.Source.asset('../site')],
        destinationBucket: publicAssets,
        distribution,
        // The file paths to invalidate in the distribution.
        distributionPaths: ["/*"],
      }
    );
  }
}

module.exports = { CdkStack }
