import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { check } from "../../../auth/check";
import { EAction } from "../../../auth/enums/action.enum";
import { ESubject } from "../../../auth/enums/subject.enum";
import { getQueueItem } from "./get-queue-item";
import middy from "@middy/core";
import { validate } from "../../../middleware/validate";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import Ajv, { JSONSchemaType } from "ajv";
import errorLogger from "@middy/error-logger";

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
  if (!check(event, EAction.Read, ESubject.QueueItem)) {
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
