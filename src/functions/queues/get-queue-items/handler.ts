import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { check } from "../../../auth/check";
import { EAction } from "../../../auth/enums/action.enum";
import { ESubject } from "../../../auth/enums/subject.enum";
import { getQueueItems } from "./get-queue-items";
import middy from "@middy/core";
import { validate } from "../../../middleware/validate";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import Ajv, { JSONSchemaType } from "ajv";

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
          minLength: 26,
          maxLength: 26,
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
  if (!check(event, EAction.Read, ESubject.QueueItem)) {
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
