import { APIGatewayProxyHandler } from "aws-lambda";
import { ddbDocClient } from "../dynamoDB";
import { ulid } from "ulid";

import {
  BatchGetCommand,
  UpdateCommand,
  TransactWriteCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { TableName } from "../db";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

import { Item } from "../baseItem";

export type IService = {
  id: string;
  name: string;
  description: string;
};

export class ServiceItem extends Item implements IService {
  static prefixService = "S#";

  id: string;
  name: string;
  description: string;

  constructor(service: IService) {
    super();
    this.id = service.id;
    this.name = service.name;
    this.description = service.description;
  }

  get PK() {
    return ServiceItem.prefixService;
  }

  get SK() {
    return ServiceItem.prefixService + this.id;
  }

  toItem(): Record<string, unknown> {
    return {
      ...this.keys(),
      name: this.name,
      description: this.description,
    };
  }

  static fromItem(item: Record<string, unknown>): ServiceItem {
    return new ServiceItem({
      id: (item.SK as string).replace(ServiceItem.prefixService, ""),
      name: item.name as string,
      description: item.description as string,
    });
  }

  static buildKey(id: string): {
    PK: string;
    SK: string;
  } {
    return {
      PK: ServiceItem.prefixService,
      SK: ServiceItem.prefixService + id,
    };
  }
}

export const handler: APIGatewayProxyHandler = async (event, context) => {
  try {
    switch (event.httpMethod) {
      case "GET": {
        const result = await getServices();
        return {
          statusCode: 200,
          body: JSON.stringify(result),
        };
      }
      case "POST": {
        if (!event.body) {
          return {
            statusCode: 400,
            body: "Bad Request",
          };
        }
        const { name, description } = JSON.parse(event.body);
        const res = await createService({ name, description });

        return {
          statusCode: 201,
          body: JSON.stringify(res),
        };
      }
      case "PUT": {
        const id = event.pathParameters?.serviceId;
        if (!id) {
          return {
            statusCode: 400,
            body: "Bad Request",
          };
        }
        if (!event.body) {
          return {
            statusCode: 400,
            body: "Bad Request",
          };
        }

        const { name, description } = JSON.parse(event.body);
        const service = await updateService({ id, name, description });
        return {
          statusCode: 200,
          body: JSON.stringify(service),
        };
      }
      case "DELETE": {
        const id = event.pathParameters?.serviceId;
        if (!id) {
          return {
            statusCode: 400,
            body: "Bad Request",
          };
        }
        await deleteService(id);
        return {
          statusCode: 200,
          body: JSON.stringify({}),
        };
      }
      default:
        return {
          statusCode: 405,
          body: "Method Not Allowed",
        };
    }
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

// getServiceHandler
export const getServiceHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const id = event.pathParameters?.serviceId;
    if (!id) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
    const service = await getService(id);
    return {
      statusCode: 200,
      body: JSON.stringify(service),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

async function getService(id: string): Promise<IService> {
  const result = await ddbDocClient.send(
    new GetCommand({ TableName, Key: ServiceItem.buildKey(id) })
  );

  if (!result.Item) {
    throw new Error("Not Found");
  }
  return ServiceItem.fromItem(result.Item);
}

async function getServices(): Promise<IService[]> {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "PK = :pk and begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": ServiceItem.prefixService,
        ":sk": ServiceItem.prefixService,
      },
    })
  );

  return result.Items?.map((item) => ServiceItem.fromItem(item)) || [];
}

async function createService({
  name,
  description,
}: Omit<IService, "id">): Promise<IService> {
  const id = ulid();
  const serviceItem = new ServiceItem({ id, name, description });

  await ddbDocClient.send(
    new PutCommand({
      TableName,
      Item: serviceItem.toItem(),
    })
  );

  return {
    id: id,
    name: name,
    description: description,
  };
}

async function updateService(service: IService): Promise<IService> {
  const serviceItem = new ServiceItem(service);
  await ddbDocClient.send(
    new UpdateCommand({
      TableName,
      Key: serviceItem.keys(),

      UpdateExpression: "set #n = :n, #d = :d",
      ExpressionAttributeNames: { "#n": "name", "#d": "description" },
      ExpressionAttributeValues: {
        ":n": service.name,
        ":d": service.description,
      },
      ConditionExpression: "attribute_exists(PK) and attribute_exists(SK)",
      ReturnValues: "ALL_NEW",
    })
  );

  return service;
}

async function deleteService(id: string) {
  await ddbDocClient.send(
    new DeleteCommand({
      TableName,
      Key: {
        PK: ServiceItem.prefixService,
        SK: ServiceItem.prefixService + id,
      },
      ConditionExpression: "attribute_exists(PK) and attribute_exists(SK)",
    })
  );

  return {
    statusCode: 204,
    body: "",
  };
}
