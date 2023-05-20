import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { check } from "../../../middleware/auth/check";
import { EAction } from "../../../middleware/auth/enums/action.enum";
import { ESubject } from "../../../middleware/auth/enums/subject.enum";
import { createServicePoint } from "./create-service-point";
import Ajv, { JSONSchemaType } from "ajv";
import middy from "@middy/core";
import jsonBodyParser from "@middy/http-json-body-parser";
import { validate } from "../../../middleware/validate";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";

interface ICreateServicePoint {
  body: {
    name: string;
    description: string;
    serviceIds?: string[];
  };
}

const schema: JSONSchemaType<ICreateServicePoint> = {
  type: "object",
  required: ["body"],
  properties: {
    body: {
      type: "object",
      properties: {
        name: {
          type: "string",
          minLength: 1,
          maxLength: 255,
        },
        description: {
          type: "string",
          minLength: 1,
          maxLength: 255,
        },
        serviceIds: {
          type: "array",
          items: {
            type: "string",
            minLength: 26,
            maxLength: 26,
          },
          nullable: true,
        },
      },
      required: ["name", "description"],
    },
  },
};

const validateEventSchema = new Ajv().compile(schema);

const lambdaHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event
) => {
  if (!check(event, EAction.Create, ESubject.ServicePoints)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }
  const payload = event as unknown as ICreateServicePoint;

  const res = await createServicePoint({
    name: payload.body.name,
    description: payload.body.description,
    serviceIds: payload.body.serviceIds,
  });

  return {
    statusCode: 201,
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
