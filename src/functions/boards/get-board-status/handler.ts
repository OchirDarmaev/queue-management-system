import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { check } from "../../../auth/check";
import { EAction } from "../../../auth/enums/action.enum";
import { ESubject } from "../../../auth/enums/subject.enum";
import { getQueuedInfo } from "./get-queued-info";
import middy from "@middy/core";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import errorLogger from "@middy/error-logger";

const lambdaHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event
) => {
  if (!check(event, EAction.Read, ESubject.QueueItem)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  const res = await getQueuedInfo();
  return {
    statusCode: 200,
    body: JSON.stringify(res),
    headers: {
      "content-type": "application/json",
    },
  };
};

export const handler = middy(lambdaHandler)
  .use(errorLogger())
  .onError(onErrorHandler);
