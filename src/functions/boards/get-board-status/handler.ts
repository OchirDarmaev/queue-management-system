import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getQueuedInfo } from "./get-queued-info";
import middy from "@middy/core";
import cors from "@middy/http-cors";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import errorLogger from "@middy/error-logger";
import { EAction } from "../../../middleware/auth/enums/action.enum";
import { check } from "../../../middleware/auth/check";
import { ESubject } from "../../../middleware/auth/enums/subject.enum";

const lambdaHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event
) => {
  if (!check(event, EAction.Read, ESubject.Queues)) {
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
  .use(
    cors({
      origin: "*",
    })
  )
  .use(errorLogger())
  .onError(onErrorHandler);
