// serverless type declaration fixes - to be removed once
// https://github.com/DefinitelyTyped/DefinitelyTyped/pull/38315 is merged and released

// tslint:disable:no-any max-classes-per-file

declare module 'serverless/classes/Plugin' {
  const serverlessOriginal = require('serverless');
  declare interface Plugin {
    hooks: {
      [event: string]: () => Promise<any>;
    };
  }

  declare var Plugin: {
    prototype: Plugin;
    new (serverless: Serverless, options: Serverless.Options): Plugin;
  };
  export = Plugin;
}

declare module 'serverless/classes/Service' {
  declare class Service {
    public custom: Service.Custom;

    public provider: {
      compiledCloudFormationTemplate: {
        Resources: {
          [key: string]: any;
        };
        Outputs?: {
          [key: string]: any;
        };
      };

      name: string;
      stage: string;
      region: string;
      runtime?: string;
      timeout?: number;
      versionFunctions: boolean;

      naming: Record<string, () => string>;
    };
    constructor(serverless: Serverless, data: {});

    public load(rawOptions: {}): Promise<any>;
    public setFunctionNames(rawOptions: {}): void;

    public getServiceName(): string;
    public getAllFunctions(): string[];
    public getAllFunctionsNames(): string[];
    public getFunction(functionName: string): Serverless.FunctionDefinition;
    public getEventInFunction(eventName: string, functionName: string): Serverless.Event;
    public getAllEventsInFunction(functionName: string): Serverless.Event[];

    public mergeResourceArrays(): void;
    public validate(): Service;

    public update(data: {}): {};
  }

  export = Service;
}

declare module 'serverless/plugins/aws/provider/awsProvider' {
  declare class Aws {
    public naming: Record<string, () => string>;
    constructor(serverless: Serverless, options: Serverless.Options);
    public getProviderName(): string;
    public getRegion(): string;
    public getServerlessDeploymentBucketName(): string;
    public getStage(): string;
  }

  export = Aws;
}

declare module 'serverless' {
  const serverlessOriginal = require('serverless');

  declare namespace Serverless {
    export declare interface Event {
      alb?: {
        listenerArn?: string | object;
      };
    }
  }

  declare class Serverless extends serverlessOriginal {}

  export = Serverless;
}
