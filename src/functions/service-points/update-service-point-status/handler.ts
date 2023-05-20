import middy from "@middy/core";
import errorLogger from "@middy/error-logger";
import jsonBodyParser from "@middy/http-json-body-parser";
import Ajv, { JSONSchemaType } from "ajv";
import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { check } from "../../../middleware/auth/check";
import { EAction } from "../../../middleware/auth/enums/action.enum";
import { ESubject } from "../../../middleware/auth/enums/subject.enum";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import { EServicePointStatus } from "../service-point-status.enum";
import { updateServicePointStatus } from "./update-service-point-status";
import { validate } from "../../../middleware/validate";

interface IUpdateServicePointStatus {
  pathParameters: {
    servicePointId: string;
  };
  body: {
    status: EServicePointStatus;
  };
}

const schema: JSONSchemaType<IUpdateServicePointStatus> = {
  type: "object",
  properties: {
    pathParameters: {
      type: "object",
      properties: {
        servicePointId: {
          type: "string",
        },
      },
      required: ["servicePointId"],
    },
    body: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: Object.values(EServicePointStatus),
        },
      },
      required: ["status"],
    },
  },
  required: ["pathParameters", "body"],
};

const validateEventSchema = new Ajv().compile(schema);

const lambdaHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event
) => {
  if (!check(event, EAction.UpdateServicePointStatus, ESubject.ServicePoints)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  const payload = event as unknown as IUpdateServicePointStatus;
  const res = await updateServicePointStatus({
    id: payload.pathParameters.servicePointId,
    servicePointStatus: payload.body.status,
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
  .use(jsonBodyParser())
  .use(errorLogger())
  .use(validate({ validateEventSchema }))
  .onError(onErrorHandler);
