import middy from "@middy/core";
import { check } from "../../../middleware/auth/check";
import { EAction } from "../../../middleware/auth/enums/action.enum";
import { ESubject } from "../../../middleware/auth/enums/subject.enum";
import { updateServicePoint } from "./update-service-point";
import jsonBodyParser from "@middy/http-json-body-parser";
import { validate } from "../../../middleware/validate";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import Ajv, { JSONSchemaType } from "ajv";
import { ulidLength } from "../../../ulid-length";
interface IUpdateServicePoint {
  pathParameters: {
    servicePointId: string;
  };
  body: {
    serviceIds?: string[];
    name?: string;
    servicePointNumber?: string;
    description?: string;
  };
}

const schema: JSONSchemaType<IUpdateServicePoint> = {
  type: "object",
  required: ["pathParameters", "body"],
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
    body: {
      type: "object",
      properties: {
        serviceIds: {
          type: "array",
          items: {
            type: "string",
            minLength: ulidLength,
            maxLength: ulidLength,
          },
          nullable: true,
        },
        name: {
          type: "string",
          minLength: 1,
          maxLength: 255,
          nullable: true,
        },
        servicePointNumber: {
          type: "string",
          minLength: 1,
          maxLength: 255,
          nullable: true,
        },
        description: {
          type: "string",
          nullable: true,
        },
      },
      required: [],
    },
  },
};

const validateEventSchema = new Ajv().compile(schema);

export async function updateServicePointHandler(event, context) {
  if (!check(event, EAction.Update, ESubject.ServicePoints)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  const payload = event as unknown as IUpdateServicePoint;

  const res = await updateServicePoint({
    id: payload.pathParameters.servicePointId,
    serviceIds: payload.body.serviceIds,
    name: payload.body.name,
    description: payload.body.description,
    servicePointNumber: payload.body.servicePointNumber,
  });
  return {
    statusCode: 200,
    body: JSON.stringify(res),
    headers: {
      "content-type": "application/json",
    },
  };
}

export const handler = middy(updateServicePointHandler)
  .use(jsonBodyParser())
  .use(validate({ validateEventSchema }))
  .use(errorLogger())
  .onError(onErrorHandler);
