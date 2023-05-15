import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { check } from "../../../auth/check";
import { EAction } from "../../../auth/enums/action.enum";
import { ESubject } from "../../../auth/enums/subject.enum";
import { getQueueItem } from "./get-queue-item";
import middy from "@middy/core";
import { validate } from "../../../middleware/validate";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import { IGetQueueItem } from "./get-queue-item.interface";
import { validateEventSchema } from "./schema.event";


const lambdaHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event,
  context
) => {
  if (!check(event, EAction.Read, ESubject.QueueItem)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }
  const item = await getQueueItem(event as unknown as IGetQueueItem);
  return {
    statusCode: 200,
    body: JSON.stringify(item),
    headers: {
      "content-type": "application/json",
    },
  };
};

export const handler = middy(lambdaHandler)
  .use(validate({ validateEventSchema }))
  .onError(onErrorHandler);
