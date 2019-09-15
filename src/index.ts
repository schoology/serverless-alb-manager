import * as Joi from '@hapi/joi';
import * as Serverless from 'serverless';
import Plugin = require('serverless/classes/Plugin');
import AwsProvider = require('serverless/plugins/aws/provider/awsProvider');

import { AlbManagerOptions } from './types';

class ServerlessPluginAlbManager implements Plugin {
  public hooks: Record<string, () => Promise<any>>; // tslint:disable-line:no-any
  private provider: AwsProvider;

  constructor(private serverless: Serverless) {
    this.provider = serverless.getProvider('aws') as AwsProvider;

    this.hooks = {
      'package:setupProviderConfiguration': this.compileAlb.bind(this),
      'package:compileFunctions': this.setEventListenerArn.bind(this),
    };
  }

  public async compileAlb(): Promise<void> {
    const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;
    const options = await this.getConfigOptions();

    // Construct CF resources
    this.addSecurityGroup(resources, options.vpcId);
    this.addLoadBalancer(resources, options.subnetIds, options.tags);
    this.addHttpListener(resources, options.certificateArn);
    this.addDnsRecord(resources, options.domainName);
  }

  public setEventListenerArn(): Promise<void> {
    const functions = this.serverless.service.getAllFunctions();
    functions.forEach((functionName: string) => {
      this.serverless.service
        .getAllEventsInFunction(functionName)
        .forEach((event: Serverless.Event, eventNum: number) => {
          // If this event is an alb event but listenerArn is not defined,
          // populate the listenerArn with the ALB Listener we created
          if (event.alb && !event.alb.listenerArn) {
            this.serverless.service.update({
              functions: {
                [functionName]: {
                  events: {
                    [eventNum]: {
                      alb: {
                        listenerArn: { Ref: 'AlbHttpListener' },
                      },
                    },
                  },
                },
              },
            });
          }
        });
    });
    return Promise.resolve();
  }

  private async getConfigOptions(): Promise<AlbManagerOptions> {
    if (!this.serverless.service.custom || !this.serverless.service.custom['serverless-alb-manager']) {
      throw new Error(
        'serverless-plugin-alb-manager: Please define ALB options in serverless.yml:custom.alb. See README.md for details.',
      );
    }

    const schema = Joi.object({
      vpcId: Joi.string().required(),
      subnetIds: Joi.alternatives()
        // Either a comma separated string, or an array of strings
        .try(
          Joi.string(),
          Joi.array()
            .items(Joi.string())
            .min(1),
        )
        .required(),
      tags: Joi.object(),
      certificateArn: Joi.string().required(),
      domainName: Joi.string()
        .domain()
        .required(),
    });

    const { value, error } = schema.validate(this.serverless.service.custom['serverless-alb-manager']);
    if (error) {
      throw new Error('serverless-plugin-alb-manager: Invalid configuration. ' + error.toString());
    }

    // Split comma-separated values
    if (typeof value.subnetIds === 'string') {
      value.subnetIds = value.subnetIds.split(',');
    }

    return value;
  }

  private addSecurityGroup(resources: object, vpcId: AlbManagerOptions['vpcId']): void {
    Object.assign(resources, {
      AlbSecurityGroup: {
        Type: 'AWS::EC2::SecurityGroup',
        Properties: {
          GroupName: `${this.provider.naming.getStackName()}-https`,
          GroupDescription: `HTTPS for ${this.provider.naming.getStackName()}`,
          VpcId: vpcId,
          SecurityGroupIngress: [
            {
              IpProtocol: 'tcp',
              FromPort: '443',
              ToPort: '443',
              CidrIp: '0.0.0.0/0',
            },
          ],
        },
      },
    });
  }

  private addLoadBalancer(
    resources: object,
    subnetIds: AlbManagerOptions['subnetIds'],
    tags: AlbManagerOptions['tags'],
  ): void {
    const cfTags = tags ? Object.keys(tags).map(key => ({ Key: key, Value: tags[key] })) : undefined;

    Object.assign(resources, {
      Alb: {
        Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        Properties: {
          Type: 'application',
          Name: `${this.provider.naming.getStackName()}-alb`,
          IpAddressType: 'ipv4',
          Scheme: 'internet-facing',
          SecurityGroups: [
            {
              Ref: 'AlbSecurityGroup',
            },
          ],
          Subnets: subnetIds,
          Tags: cfTags,
        },
      },
    });
  }

  private addHttpListener(resources: object, certificateArn: AlbManagerOptions['certificateArn']): void {
    Object.assign(resources, {
      AlbHttpListener: {
        Type: 'AWS::ElasticLoadBalancingV2::Listener',
        Properties: {
          LoadBalancerArn: {
            Ref: 'Alb',
          },
          Port: 443,
          Protocol: 'HTTPS',
          Certificates: [
            {
              CertificateArn: certificateArn,
            },
          ],
          DefaultActions: [
            {
              Type: 'fixed-response',
              Order: 1,
              FixedResponseConfig: {
                StatusCode: 403,
                ContentType: 'application/json',
                MessageBody: '{ "error": "Forbidden" }',
              },
            },
          ],
        },
      },
    });
  }

  private addDnsRecord(resources: object, domainName: AlbManagerOptions['domainName']): void {
    Object.assign(resources, {
      AlbDnsRecord: {
        Type: 'AWS::Route53::RecordSet',
        Properties: {
          HostedZoneName: this.getRootDomain(domainName) + '.',
          Name: domainName,
          Type: 'A',
          AliasTarget: {
            DNSName: {
              'Fn::GetAtt': ['Alb', 'DNSName'],
            },
            HostedZoneId: {
              'Fn::GetAtt': ['Alb', 'CanonicalHostedZoneID'],
            },
          },
        },
      },
    });
  }

  private getRootDomain(domainName: string) {
    const domainSplit = domainName.split('.').reverse();
    return domainSplit[1] + '.' + domainSplit[0];
  }
}

module.exports = ServerlessPluginAlbManager;
