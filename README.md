# ALB Manager Serverless Plugin

[![CircleCI](https://circleci.com/gh/schoology/serverless-alb-manager.svg?style=shield)](https://circleci.com/gh/schoology/serverless-alb-manager)
[![npm version](https://badge.fury.io/js/serverless-alb-manager.svg)](https://badge.fury.io/js/serverless)
[![license](https://img.shields.io/npm/l/serverless-alb-manager.svg)](https://www.npmjs.com/package/serverless-alb-manager)

This plugin adds an HTTP ALB to your serverless project instead of an API Gateway for HTTP functions.

## About Schoology

<p align="center"><img src="https://app.schoology.com/sites/all/themes/schoology_theme/images_front/schoology_thumbnail.png" width="120" alt="Schoology Logo" /></p>

Schoology, one of the fastest growing education technology companies, brings together the best K-12 learning management 
system with assessment management to improve student performance, foster collaboration, and personalize learning.
Millions of students, faculty and administrators from over 60,000 K-12 schools worldwide use Schoology to advance what is possible in education.

We help solve the most important challenges in education in an environment that’s fun, collaborative and innovative.
We are looking for smart, creative individuals who are passionate about education and aren't afraid to show it.

Learn more at https://www.schoology.com/careers.

## Requirements
Tested with:
* Node.js >= `v8.10`
* Serverless Framework >= `v1.45`

## Installation

1. Using yarn:
    ```
    yarn add --dev serverless-alb-manager
    ```

2. Add the plugin to your `serverless.yml` file:
    ```yaml
    plugins:
      - serverless-alb-manager
    ```

3. Add the plugin configuration to your `serverless.yml` file, for example:
    ```yml
      serverless-alb-manager:
        vpcId: vpc-1234
        subnetIds:
          - subnet-2345
          - subnet-3456
        tags:
          foo: fooValue
          bar: barValue
        certificateArn: "arn:aws:acm:us-east-1:4567:certificate/abcd-5678"
        domainName: alb.example.com
    ```
    
    |Parameter Name|Required|Description|
    |---|---|---|
    |`vpcId`|:heavy_check_mark:|The VPC in which the ALB should be created.|
    |`subnetIds`|:heavy_check_mark:|An array of subnet IDs to associate with the ALB. These subnets should belong to the configured `vpcId`.|
    |`tags`|:heavy_check_mark:|A map of tags for the ALB.|
    |`certificateArn`|:heavy_check_mark:|The AWS ACM certificate ARN to use for the HTTP listener.|
    |`domainName`|:heavy_check_mark:|The domain name that will be used to access the ALB. This should be valid for the given `certificateArn`.|

4. Add alb event listeners to your serverless functions. The `listenerArn` will
automatically be populated with the ALB listener created by this plugin. For example:

    ```yaml
    functions:
      foo:
        handler: src/handler.foo
        events:
          - alb:
              # libraryArn is automatically populated
              priority: 1
              conditions:
                path: '/foo'
                method: GET
       bar:
        handler: src/handler.bar
        events:
          - alb:
              # libraryArn is automatically populated
              priority: 2
              conditions:
                path: '/bar'
                method: GET
   
    ```

## Resource Created By This Plugin

|Type|Description|
|---|---|
|**Security Group**|<ul><li>ingress `443` from `0.0.0.0/0`</li><li>egress `*` to `0.0.0.0/0`</li><li>configurable VPC</li></ul>|
|**Application Load Balancer**|<ul><li>ipv4</li><li>configurable subnet</li><li>configurable tags</li></ul>|
|**ALB Listener**|<ul><li>default action `HTTP 403` with JSON body `{ "error": "Forbidden" }`</li><li>configurable ACM certificate ARN</li></ul>|
|**Route53 DNS Record**|<ul><li>Alias pointing to ALB</li><li>Configurable domain name</li></ul>|
