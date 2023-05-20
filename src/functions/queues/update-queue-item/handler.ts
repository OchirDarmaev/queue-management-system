import Ajv, { JSONSchemaType } from "ajv";
import { EQueuePriority } from "../enums/queue-priority.enum";
import { updateQueueItem } from "./update-queue-item";
import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import middy from "@middy/core";
import jsonBodyParser from "@middy/http-json-body-parser";
import { validate } from "../../../middleware/validate";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import { check } from "../../../middleware/auth/check";
import { EAction } from "../../../middleware/auth/enums/action.enum";
import { ESubject } from "../../../middleware/auth/enums/subject.enum";

interface IUpdateQueueItem {
  body: {
    priority: EQueuePriority;
  };
  pathParameters: {
    queueId: string;
  };
}

const schema: JSONSchemaType<IUpdateQueueItem> = {
  type: "object",
  required: ["body", "pathParameters"],
  properties: {
    body: {
      type: "object",
      properties: {
        priority: {
          type: "string",
          enum: Object.values(EQueuePriority),
        },
      },
      required: ["priority"],
    },
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
  event
) => {
  if (!check(event, EAction.Update, ESubject.Queues)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }
  const payload = event as unknown as IUpdateQueueItem;

  const res = await updateQueueItem({
    queueId: payload.pathParameters.queueId,
    priority: payload.body.priority,
  });
  return {
    statusCode: 200,
    body: JSON.stringify(res),
  };
};

export const lambda = middy(lambdaHandler)
  .use(jsonBodyParser())
  .use(validate({ validateEventSchema }))
  .use(errorLogger())
  .onError(onErrorHandler);
