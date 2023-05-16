import middy from "@middy/core";
import { createQueueItem } from "./create-queue-item";
import jsonBodyParser from "@middy/http-json-body-parser";
import { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { validate } from "../../../middleware/validate";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import Ajv, { JSONSchemaType } from "ajv";
import errorLogger from "@middy/error-logger";

interface ICreateQueueItem {
  body: {
    serviceId: string;
  };
}

const schema: JSONSchemaType<ICreateQueueItem> = {
  type: "object",
  required: ["body"],
  properties: {
    body: {
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

const lambdaHandler: APIGatewayProxyHandlerV2 = async (
  event: APIGatewayProxyEventV2
) => {
  const payload = event as unknown as ICreateQueueItem;
  const res = await createQueueItem({ serviceId: payload.body.serviceId });
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
