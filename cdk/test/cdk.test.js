const cdk = require('@aws-cdk/core');
const { SynthUtils } = require('@aws-cdk/assert');
const { CdkStack } = require('../lib/cdk-stack');

test('Splash Page stack snapshot', () => {
    const app = new cdk.App();
    const stack = new CdkStack(app, 'MonomerStaticSiteStack', {
      env: {
        account: '123456789',
        region: 'us-west-2',
      },
    })

    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});
