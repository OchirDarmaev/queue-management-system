import Ajv, { JSONSchemaType } from "ajv";
import { check } from "../../../auth/check";
import { EAction } from "../../../auth/enums/action.enum";
import { ESubject } from "../../../auth/enums/subject.enum";
import { deleteService } from "./delete-service";
import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import middy from "@middy/core";
import { validate } from "../../../middleware/validate";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";

interface IDeleteService {
  pathParameters: {
    serviceId: string;
  };
}

const schema: JSONSchemaType<IDeleteService> = {
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
  event,
  context
) => {
  if (!check(event, EAction.Delete, ESubject.Services)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }
  const payload = event as unknown as IDeleteService;
  await deleteService({ id: payload.pathParameters.serviceId });

  return {
    statusCode: 204,
  };
};

export const handler = middy(lambdaHandler)
  .use(validate({ validateEventSchema }))
  .use(errorLogger())
  .onError(onErrorHandler);
