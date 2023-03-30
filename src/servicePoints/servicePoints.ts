import { APIGatewayProxyHandler } from "aws-lambda";
import { ddbDocClient } from "../dynamoDB";
import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";
import { prefixService, prefixServicePoint, TableName } from "../db";
import {
  BatchGetItemCommand,
  TransactWriteItemsCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

export enum ServicePointStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export const createServicePointHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { servicePointId, serviceIds, name, description } = JSON.parse(
      event.body
    );
    const res = await createServicePoint({
      servicePointId,
      serviceIds,
      name,
      description,
    });
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

export const getServicePointHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { servicePointId } = event.pathParameters;
    const res = await getServicePoint({ servicePointId });
    return {
      statusCode: 200,
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

export const getServicePointsHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const res = await getServicePoints();
    return {
      statusCode: 200,
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

export const updateServicePointHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { servicePointId } = event.pathParameters;
    const { serviceIds, name, description, status } = JSON.parse(event.body);
    const res = await updateServicePoint({
      servicePointId,
      serviceIds,
      name,
      description,
      servicePointStatus: status,
    });
    return {
      statusCode: 200,
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

export const deleteServicePointHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { servicePointId } = event.pathParameters;
    const res = await deleteServicePoint({ servicePointId });
    return {
      statusCode: 200,
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

async function getServicePoints() {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": prefixServicePoint,
      },
    })
  );
  const keys = result.Items.map((item) => ({
    PK: item.SK,
    SK: item.SK,
  }));
  const servicePoints = await ddbDocClient.send(
    new BatchGetCommand({
      RequestItems: {
        [TableName]: {
          Keys: keys,
        },
      },
    })
  );
  return servicePoints.Responses[TableName];
}

async function createServicePoint({
  servicePointId,
  serviceIds,
  name,
  description,
}: {
  servicePointId?: string;
  serviceIds: string[];
  name: string;
  description: string;
}) {
  const pk = servicePointId ?? ulid();

  await ddbDocClient.send(
    new TransactWriteItemsCommand({
      TransactItems: [
        {
          Put: {
            TableName,
            Item: {
              PK: {
                S: prefixServicePoint + pk,
              },
              SK: {
                S: prefixServicePoint + pk,
              },
              servicePointName: {
                S: name,
              },
              description: {
                S: description,
              },
              servicePointStatus: {
                S: ServicePointStatus.INACTIVE,
              },
              serviceIds: {
                L:
                  serviceIds.map((x) => ({
                    S: x,
                  })) ?? [],
              },
            },
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
        {
          Put: {
            TableName,
            Item: {
              PK: {
                S: prefixServicePoint,
              },
              SK: {
                S: prefixServicePoint + pk,
              },
            },
          },
        },
      ],
    })
  );

  return {
    id: pk,
    name,
    description,
  };
}

async function getServicePoint({ servicePointId }: { servicePointId: string }) {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: {
        PK: prefixServicePoint + servicePointId,
        SK: prefixServicePoint + servicePointId,
      },
    })
  );
  return result.Item;
}

async function updateServicePoint({
  servicePointId,
  serviceIds,
  name,
  description,
  servicePointStatus: servicePointStatus,
}: {
  servicePointId: string;
  name: string;
  description: string;
  servicePointStatus: ServicePointStatus;
  serviceIds: string[];
}) {
  if (serviceIds.length) {
    const result1 = await ddbDocClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TableName]: {
            Keys: serviceIds.map((id) => ({
              PK: prefixService + id,
              SK: prefixService + id,
            })),
          },
        },
      })
    );

    if (result1.Responses[TableName].length !== serviceIds.length) {
      throw new Error("Service not found");
    }
  }

  const result = await ddbDocClient.send(
    new UpdateCommand({
      TableName,
      Key: {
        PK: prefixServicePoint + servicePointId,
        SK: prefixServicePoint + servicePointId,
      },
      UpdateExpression:
        "SET serviceIds = :serviceIds, servicePointName = :name, description = :description, servicePointStatus = :servicePointStatus",
      ExpressionAttributeValues: {
        ":serviceIds": serviceIds,
        ":name": name,
        ":description": description,
        ":servicePointStatus": servicePointStatus,
      },
      ConditionExpression: "attribute_exists(PK) and attribute_exists(SK)",
      ReturnValues: "ALL_NEW",
    })
  );

  return result.Attributes;
}

async function deleteServicePoint({
  servicePointId,
}: {
  servicePointId: string;
}) {
  const result = await ddbDocClient.send(
    new DeleteCommand({
      TableName,
      Key: {
        PK: prefixServicePoint + servicePointId,
        SK: prefixServicePoint + servicePointId,
      },
      ConditionExpression: "attribute_exists(PK) and attribute_exists(SK)",
    })
  );
  return result;
}
