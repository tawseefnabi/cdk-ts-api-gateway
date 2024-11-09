import * as cdk from 'aws-cdk-lib';
import * as  lambda  from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import {ICdkTsApiGatewayStackProps, IValidators} from '../bin/stack-config-types'


export class CdkTsApigwStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ICdkTsApiGatewayStackProps) {
    super(scope, id, props);
    // lambda for resolving api requests
    const resolver = new lambda.Function(this, 'LambdaResolver', {
      functionName: props.lambda.name,
      description: props.lambda.desc,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        `${process.cwd()}/src`,
        {}
      ),
      memorySize: props.lambda.memory,
      timeout: cdk.Duration.seconds(props.lambda.timeout)
    });
    const integration = new apigateway.LambdaIntegration(resolver);

    // API Gatewaay RestApi
    const api = new apigateway.RestApi(this, 'RestApi',{
      restApiName: props.api.name,
      description: props.api.desc,
      defaultCorsPreflightOptions:{
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE']
      }
    });

    // request validators
    const createValidator = (input: IValidators) => new apigateway.RequestValidator(
      this, 
      input.requestValidatorName,
    {
      restApi: api,
      requestValidatorName: input.requestValidatorName,
      validateRequestBody: input.validateRequestBody,
      validateRequestParameters: input.validateRequestParameters,
    });
    

    const bodyValidator = createValidator(props.validators.bodyValidator);
    const paramsValidator = createValidator(props.validators.paramValidator);
    const bodyAndParamValidator = createValidator(props.validators.bodyAndParamValidator);

    // API Gateway model
     const model = new apigateway.Model(this, 'Model',{
      modelName: props.api.modelName,
      restApi: api,
      schema: {
          type: apigateway.JsonSchemaType.OBJECT,
          required: ['name'],
          properties:{
            name: {type: apigateway.JsonSchemaType.STRING}
          }
      }
     });

     // root resources
      const rootResource = api.root.addResource(props.api.rootResource);

     // Open Resource and Methods
      const openResource = rootResource.addResource('open');

      ['GET', 'POST', 'PATCH', 'DELETE'].map((method)=>{
        openResource.addMethod(method, integration, {
          operationName: `${method} Open Resource`,
        });
      });

      // secure Resource and Methods
      const secureResource = rootResource.addResource('secure');
      const paramResource = secureResource.addResource('{param}');

      secureResource.addMethod('GET', integration, {
        operationName: 'GET Secure Resource',
        apiKeyRequired: true
      });

      secureResource.addMethod('POST', integration, {
        operationName: 'POST Secure Resource',
        apiKeyRequired: true,
        requestValidator: bodyValidator,
        requestModels: {'application/json': model}
      });

      ['GET', 'DELETE'].map((method)=>{
        paramResource.addMethod(method, integration, {
          operationName: `${method} Secure Resource`,
          apiKeyRequired: true,
          requestValidator: paramsValidator,
          requestParameters: {'method.request.path.param': true}
        });
      });
      paramResource.addMethod('PATCH', integration,{
        operationName: 'PATCH Secure  param Resource',
          apiKeyRequired: true,
          requestValidator: bodyAndParamValidator,
          requestModels: {'application/json': model},
          requestParameters: {'method.request.path.param': true}
      })

      // API UsagePlan
      const usageplan = api.addUsagePlan('UsagePlan',{
        name: props.usageplan.name,
        description: props.usageplan.desc,
        apiStages:[{
          api:api,
          stage: api.deploymentStage
        }],
        quota: {
          limit: props.usageplan.limit,
          period: apigateway.Period.DAY   // which timperiod to do these calls
        },
        throttle: {
          rateLimit: props.usageplan.rateLimit, // how many in a short call
          burstLimit: props.usageplan.burstLimit  // 
        }
      });

      // API key for authorization
       const apiKey = api.addApiKey('ApiKey',{
          apiKeyName: props.apiKey.name,
          description: props.apiKey.desc
       });

       usageplan.addApiKey(apiKey);
  }
}
