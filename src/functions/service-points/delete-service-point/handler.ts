import Ajv, { JSONSchemaType } from "ajv";
import { check } from "../../../middleware/auth/check";
import { EAction } from "../../../middleware/auth/enums/action.enum";
import { ESubject } from "../../../middleware/auth/enums/subject.enum";
import { deleteServicePoint } from "./delete-service-point";
import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { validate } from "../../../middleware/validate";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import middy from "@middy/core";
import { ulidLength } from "../../../ulid-length";

interface IDeleteServicePoint {
  pathParameters: {
    servicePointId: string;
  };
}

const schema: JSONSchemaType<IDeleteServicePoint> = {
  type: "object",
  required: ["pathParameters"],
  properties: {
    pathParameters: {
      type: "object",
      properties: {
        servicePointId: {
          type: "string",
          minLength: ulidLength,
          maxLength: ulidLength,
        },
      },
      required: ["servicePointId"],
    },
  },
};

const validateEventSchema = new Ajv().compile(schema);

const lambdaHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event
) => {
  if (!check(event, EAction.Delete, ESubject.ServicePoints)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }
  const payload = event as unknown as IDeleteServicePoint;

  const res = await deleteServicePoint({
    id: payload.pathParameters.servicePointId,
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
  .use(validate({ validateEventSchema }))
  .use(errorLogger())
  .onError(onErrorHandler);
