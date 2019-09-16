import * as fs from 'fs';
import * as Serverless from 'serverless';
import Service = require('serverless/classes/Service');
import * as TypeMoq from 'typemoq';

const ServiceClass = require('serverless/lib/classes/Service'); // tslint:disable-line

import { ServerlessPluginAlbManager } from './index';
import { AlbManagerOptions } from './types';

/**
 * Mock a `custom.serverless-alb-manager` config from the Service mock
 */
const setConfig = (service: Service, config: object): void => {
  service.update({ custom: { ['serverless-alb-manager']: config } });
};

describe('ServerlessPluginAlbManager', () => {
  let serverlessMock: TypeMoq.IMock<Serverless>;
  let service: Service;
  let plugin: ServerlessPluginAlbManager;
  let providerObject: Service['provider'];
  let validConfig: AlbManagerOptions;

  beforeEach(() => {
    providerObject = {
      compiledCloudFormationTemplate: {
        Outputs: {},
        Resources: {},
      },
      name: 'dummy-provider-name',
      stage: 'dummy-provider-stage',
      region: 'dummy-provider-region',
      versionFunctions: true,
      naming: {
        getStackName: () => 'dummy-stack-name',
      },
    };

    validConfig = {
      vpcId: 'dummy-vpc-id',
      subnetIds: ['dummy-subnet-1', 'dummy-subnet-2'],
      certificateArn: 'dummy-certificate-arn',
      domainName: 'dummy.domain.example.com',
      tags: {
        dummyTag1: 'dummy-1',
        dummyTag2: 'dummy-2',
      },
    };

    serverlessMock = TypeMoq.Mock.ofType<Serverless>();

    service = new ServiceClass(serverlessMock.object, {
      provider: providerObject,
    });

    serverlessMock.setup(x => x.service).returns(() => service);
    serverlessMock.setup(x => x.getProvider(TypeMoq.It.isAnyString())).returns(() => providerObject);

    plugin = new ServerlessPluginAlbManager(serverlessMock.object);
  });

  describe('package:setupProviderConfiguration hook', () => {
    describe('with all expected config options', () => {
      beforeEach(() => {
        setConfig(service, validConfig);
      });

      it('generates a valid cloudformation template', async () => {
        await plugin.hooks['package:setupProviderConfiguration']();
        expect(service.provider.compiledCloudFormationTemplate).toMatchSnapshot();

        // Write out a JSON that will be validated during CI
        fs.writeFileSync(
          'template-snapshot.json',
          // tslint:disable-next-line:no-magic-numbers
          JSON.stringify(service.provider.compiledCloudFormationTemplate, undefined, 2),
        );
      });
    });

    describe('without tags', () => {
      beforeEach(() => {
        setConfig(service, {
          ...validConfig,
          tags: undefined,
        });
      });

      it('does not set any tags', async () => {
        await plugin.hooks['package:setupProviderConfiguration']();
        expect(service.provider.compiledCloudFormationTemplate.Resources.Alb.Properties.Tags).toBeUndefined();
      });
    });

    describe('with comma-separated subnet IDs', () => {
      beforeEach(() => {
        setConfig(service, {
          ...validConfig,
          subnetIds: 'dummy-subnet-3, dummy-subnet-4',
        });
      });

      it('splits the subnets into an array', async () => {
        await plugin.hooks['package:setupProviderConfiguration']();
        expect(service.provider.compiledCloudFormationTemplate.Resources.Alb.Properties.Subnets).toMatchObject([
          'dummy-subnet-3',
          'dummy-subnet-4',
        ]);
      });
    });

    describe('with no config options', () => {
      it('throws an error', () => {
        return expect(plugin.hooks['package:setupProviderConfiguration']()).rejects.toThrowError(
          'serverless-plugin-alb-manager: Please define ALB options in serverless.yml:custom.alb. See README.md for details.',
        );
      });
    });

    describe('with invalid config options', () => {
      beforeEach(() => {
        setConfig(service, {
          foo: 'bar',
        });
      });

      it('throws an error', () => {
        return expect(plugin.hooks['package:setupProviderConfiguration']()).rejects.toThrowError(
          'serverless-plugin-alb-manager: Invalid configuration. ValidationError: ' +
            '"vpcId" is required. ' +
            '"subnetIds" is required. ' +
            '"certificateArn" is required. ' +
            '"domainName" is required. ' +
            '"foo" is not allowed',
        );
      });
    });
  });

  describe('package:compileFunctions hook', () => {
    describe('with alb events that do not have listenerArn defined', () => {
      beforeEach(() => {
        service.update({
          functions: {
            dummyFunc1: {
              events: [{ alb: { conditions: { path: '/dummy11' } } }, { alb: { conditions: { path: '/dummy12' } } }],
            },
            dummyFunc2: {
              events: [{ alb: { conditions: { path: '/dummy21' } } }, { alb: { conditions: { path: '/dummy22' } } }],
            },
          },
        });
        service.setFunctionNames({});
      });

      it('sets the event listenerArns', async () => {
        await plugin.hooks['package:compileFunctions']();
        const expectedListener = {
          Ref: 'AlbHttpListener',
        };
        expect(service.getAllEventsInFunction('dummyFunc1')[0].alb.listenerArn).toMatchObject(expectedListener);
        expect(service.getAllEventsInFunction('dummyFunc1')[1].alb.listenerArn).toMatchObject(expectedListener);
        expect(service.getAllEventsInFunction('dummyFunc2')[0].alb.listenerArn).toMatchObject(expectedListener);
        expect(service.getAllEventsInFunction('dummyFunc2')[1].alb.listenerArn).toMatchObject(expectedListener);
      });
    });

    describe('with alb events that do have listenerArn defined', () => {
      beforeEach(() => {
        service.update({
          functions: {
            dummyFunc1: {
              events: [
                {
                  alb: {
                    conditions: { path: '/dummy11' },
                    listenerArn: 'dummyListenerArn',
                  },
                },
              ],
            },
          },
        });
        service.setFunctionNames({});
      });

      it('sets the event listenerArns', async () => {
        await plugin.hooks['package:compileFunctions']();
        expect(service.getAllEventsInFunction('dummyFunc1')[0].alb.listenerArn).toBe('dummyListenerArn');
      });
    });

    describe('with non-alb events', () => {
      const nonAlbEvents = [{ http: 'GET /dummyFunc1' }];
      beforeEach(() => {
        service.update({
          functions: {
            dummyFunc1: { events: nonAlbEvents },
          },
        });
        service.setFunctionNames({});
      });

      it('does not modify the events', async () => {
        await plugin.hooks['package:compileFunctions']();
        expect(service.getAllEventsInFunction('dummyFunc1')).toMatchObject(nonAlbEvents);
      });
    });
  });
});
