import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { check } from "../../../auth/check";
import { EAction } from "../../../auth/enums/action.enum";
import { ESubject } from "../../../auth/enums/subject.enum";
import Ajv, { JSONSchemaType } from "ajv";
import middy from "@middy/core";
import { validate } from "../../../middleware/validate";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import { updateService } from "./update-service";
import jsonBodyParser from "@middy/http-json-body-parser";

interface IUpdateService {
  pathParameters: {
    serviceId: string;
  };
  body: {
    name?: string;
    description?: string;
  };
}

const schema: JSONSchemaType<IUpdateService> = {
  type: "object",
  properties: {
    pathParameters: {
      type: "object",
      properties: {
        serviceId: {
          type: "string",
        },
      },
      required: ["serviceId"],
    },
    body: {
      type: "object",
      properties: {
        name: {
          type: "string",
          nullable: true,
        },
        description: {
          type: "string",
          nullable: true,
        },
      },
    },
  },
  required: ["pathParameters"],
};

const validateEventSchema = new Ajv().compile(schema);

const lambdaHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event
) => {
  if (!check(event, EAction.Read, ESubject.Services)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  const payload = event as unknown as IUpdateService;
  const res = await updateService({
    id: payload.pathParameters.serviceId,
    name: payload.body.name,
    description: payload.body.description,
  });

  return {
    statusCode: 200,
    body: JSON.stringify(res),
    headers: {
      "content-type": "application/json",
    },
  };
};

export const handler = middy(lambdaHandler)
  .use(jsonBodyParser())
  .use(validate({ validateEventSchema }))
  .use(errorLogger())
  .onError(onErrorHandler);
