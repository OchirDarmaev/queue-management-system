import { APIGatewayProxyHandler } from "aws-lambda";
import { ddbDocClient } from "../ddb-doc-client";
import { ulid } from "ulid";

import {
  BatchGetCommand,
  UpdateCommand,
  TransactWriteCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { TableName } from "../table-name";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

import { IService } from "./IService";
import { ServiceItem } from "./ServiceItem";
import { check } from "../auth/check";
import { EAction } from "../auth/enums/action.enum";
import { ESubject } from "../auth/enums/subject.enum";

// GET createServiceHandler
export const createServiceHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  if (!check(event, EAction.Create, ESubject.Services)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }
  try {
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
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

// GET getAllServicesHandler
export const getAllServicesHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  if (!check(event, EAction.Read, ESubject.Services)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }
  try {
    const result = await getServices();
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

// GET getServicesHandler
export const getServicesHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  if (!check(event, EAction.Read, ESubject.Services)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }
  try {
    const result = await getServices();
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
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
  if (!check(event, EAction.Read, ESubject.Services)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }
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

// PUT updateServiceHandler
export const updateServiceHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  if (!check(event, EAction.Update, ESubject.Services)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }
  try {
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
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

// DELETE deleteServiceHandler
export const deleteServiceHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  if (!check(event, EAction.Delete, ESubject.Services)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }
  try {
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
