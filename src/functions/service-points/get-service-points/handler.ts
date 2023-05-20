import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { check } from "../../../auth/check";
import { EAction } from "../../../auth/enums/action.enum";
import { ESubject } from "../../../auth/enums/subject.enum";
import { getServicePoints } from "./get-service-points";
import middy from "@middy/core";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";

const lambdaHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event
) => {
  if (!check(event, EAction.Read, ESubject.ServicePoint)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  const res = await getServicePoints();
  return {
    statusCode: 200,
    body: JSON.stringify(res),
  };
};

export const handler = middy(lambdaHandler)
  .use(errorLogger())
  .onError(onErrorHandler);
