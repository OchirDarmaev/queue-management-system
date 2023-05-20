import Ajv, { JSONSchemaType } from "ajv";
import { check } from "../../../auth/check";
import { EAction } from "../../../auth/enums/action.enum";
import { ESubject } from "../../../auth/enums/subject.enum";
import { createService } from "./create-service";
import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import middy from "@middy/core";
import jsonBodyParser from "@middy/http-json-body-parser";
import { validate } from "../../../middleware/validate";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";

interface ICreateService {
  body: {
    name: string;
    description: string;
  };
}

const schema: JSONSchemaType<ICreateService> = {
  type: "object",
  required: ["body"],
  properties: {
    body: {
      type: "object",
      required: ["name"],
      properties: {
        name: {
          type: "string",
        },
        description: {
          type: "string",
        },
      },
    },
  },
};

const validateEventSchema = new Ajv().compile(schema);

const lambdaHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event
) => {
  if (!check(event, EAction.Create, ESubject.Services)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  const payload = event as unknown as ICreateService;
  const res = await createService({
    name: payload.body.name,
    description: payload.body.description,
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
