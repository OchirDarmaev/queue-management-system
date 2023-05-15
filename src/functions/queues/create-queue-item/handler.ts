import middy from "@middy/core";
import { createQueueItem } from "./create-queue-item";
import jsonBodyParser from "@middy/http-json-body-parser";
import { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { validate } from "../../../middleware/validate";
import { validateEventSchema } from "./schema.event";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import { ICreateQueueItem } from "./create-queue-item.interface";

const lambdaHandler: APIGatewayProxyHandlerV2 = async (
  event: APIGatewayProxyEventV2
) => {
  const res = await createQueueItem(event as unknown as ICreateQueueItem);
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
  .onError(onErrorHandler);
