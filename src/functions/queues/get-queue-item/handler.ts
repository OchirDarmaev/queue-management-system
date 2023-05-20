import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { getQueueItem } from "./get-queue-item";
import middy from "@middy/core";
import { validate } from "../../../middleware/validate";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import Ajv, { JSONSchemaType } from "ajv";
import errorLogger from "@middy/error-logger";
import { EAction } from "../../../middleware/auth/enums/action.enum";
import { check } from "../../../middleware/auth/check";
import { ESubject } from "../../../middleware/auth/enums/subject.enum";

interface IGetQueueItem {
  pathParameters: {
    queueId: string;
  };
}

const schema: JSONSchemaType<IGetQueueItem> = {
  type: "object",
  required: ["pathParameters"],
  properties: {
    pathParameters: {
      type: "object",
      properties: {
        queueId: {
          type: "string",
          minLength: 26,
          maxLength: 26,
        },
      },
      required: ["queueId"],
    },
  },
};

const validateEventSchema = new Ajv().compile(schema);

const lambdaHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event,
  context
) => {
  if (!check(event, EAction.Read, ESubject.Queues)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  const payload = event as unknown as IGetQueueItem;
  const item = await getQueueItem({
    queueId: payload.pathParameters.queueId,
  });
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
  .use(errorLogger())
  .onError(onErrorHandler);
