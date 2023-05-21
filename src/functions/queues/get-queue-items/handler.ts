import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";

import { getQueueItems } from "./get-queue-items";
import middy from "@middy/core";
import { validate } from "../../../middleware/validate";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import Ajv, { JSONSchemaType } from "ajv";
import { check } from "../../../middleware/auth/check";
import { EAction } from "../../../middleware/auth/enums/action.enum";
import { ESubject } from "../../../middleware/auth/enums/subject.enum";
import { ulidLength } from "../../../ulid-length";

interface IGetQueueItems {
  pathParameters: {
    serviceId: string;
  };
}

const schema: JSONSchemaType<IGetQueueItems> = {
  type: "object",
  required: ["pathParameters"],
  properties: {
    pathParameters: {
      type: "object",
      properties: {
        serviceId: {
          type: "string",
          minLength: ulidLength,
          maxLength: ulidLength,
        },
      },
      required: ["serviceId"],
    },
  },
};

const validateEventSchema = new Ajv().compile(schema);

const lambdaHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event
) => {
  if (!check(event, EAction.Read, ESubject.Queues)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  const payload = event as unknown as IGetQueueItems;
  const res = await getQueueItems({
    serviceId: payload.pathParameters.serviceId,
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
  .use(validate({ validateEventSchema }))
  .onError(onErrorHandler);
