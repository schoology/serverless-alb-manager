// serverless type declaration fixes - to be removed once
// https://github.com/DefinitelyTyped/DefinitelyTyped/pull/38315 is merged and released

// tslint:disable:no-any

declare module 'serverless/classes/Plugin' {
  interface Plugin {
    hooks: {
      [event: string]: () => Promise<any>;
    };
  }
  export = Plugin;
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

  // tslint:disable-next-line
  declare class Serverless extends serverlessOriginal {}

  export = Serverless;
}
