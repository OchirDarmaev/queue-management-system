import middy from "@middy/core";
import errorLogger from "@middy/error-logger";
import Ajv, { JSONSchemaType } from "ajv";
import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { check } from "../../../middleware/auth/check";
import { EAction } from "../../../middleware/auth/enums/action.enum";
import { ESubject } from "../../../middleware/auth/enums/subject.enum";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import { getServicePoint } from "./get-service-point";
import { validate } from "../../../middleware/validate";
import { ulidLength } from "../../../ulid-length";

interface IGetServicePoint {
  pathParameters: {
    servicePointId: string;
  };
}

const schema: JSONSchemaType<IGetServicePoint> = {
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
  if (!check(event, EAction.Read, ESubject.ServicePoints)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }
  const payload = event as unknown as IGetServicePoint;

  const res = await getServicePoint({
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
