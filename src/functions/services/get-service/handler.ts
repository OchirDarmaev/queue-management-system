import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { check } from "../../../auth/check";
import { EAction } from "../../../auth/enums/action.enum";
import { ESubject } from "../../../auth/enums/subject.enum";
import { getService } from "./get-service";
import Ajv, { JSONSchemaType } from "ajv";
import middy from "@middy/core";
import { validate } from "../../../middleware/validate";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";

interface IGetService {
  pathParameters: {
    serviceId: string;
  };
}

const schema: JSONSchemaType<IGetService> = {
  type: "object",
  properties: {
    pathParameters: {
      type: "object",
      properties: {
        serviceId: {
          type: "string",
        },
      },
      required: ["serviceId"],
    },
  },
  required: ["pathParameters"],
};

const validateEventSchema = new Ajv().compile(schema);

const lambdaHandler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (
  event
) => {
  if (!check(event, EAction.Read, ESubject.Services)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  const payload = event as unknown as IGetService;
  const res = await getService({ id: payload.pathParameters.serviceId });

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
